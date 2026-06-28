# Arquitectura — Polla Mundial 26

## Stack elegido

| Capa | Elección | Por qué |
|---|---|---|
| Backend | Node.js + Express + TypeScript | Proceso persistente real (necesario para `node-cron`), tipado para una lógica de sync/scoring que debe ser correcta. |
| Base de datos | PostgreSQL vía `pg` (node-postgres) con SQL explícito | Persistencia real, gratis en Neon/Supabase sin tarjeta de crédito. Se descartó SQLite porque en el hosting recomendado (Render free) el filesystem es efímero entre deploys/restarts. Se evaluó Prisma, pero se optó por `pg` puro para no depender de la descarga de su binario nativo de query-engine (un punto de fallo extra en redes con proxy/firewall corporativo) — con 5 tablas, SQL explícito en `db/schema.sql` + `src/repo.ts` es más simple y igual de mantenible. |
| Scheduler | `node-cron` dentro del mismo proceso Express | Evita depender de un segundo servicio; configurable por `SYNC_INTERVAL_MINUTES`. En producción se puede mover a un "Cron Job" nativo de Render que llame a `POST /api/admin/sync/run` si se prefiere desacoplar. |
| Frontend | React + Vite + TypeScript | SPA liviana, mobile-first, sin necesidad de SSR para un grupo de <10 personas. |
| Tests | Vitest | Rápido, ESM/TS nativo, usado para `scoring` y `sync` (lógica pura, sin DB). |

## Por qué football-data.org como fuente de datos

Se evaluaron 3 opciones (investigadas en julio 2026):

- **football-data.org**: el Mundial está incluido en el plan gratis, con límite de 10 llamadas/minuto. Como el job corre cada 30–60 minutos (1 llamada de fixtures + 1 de resultados por corrida en el peor caso), el límite sobra con margen amplio. API simple: un solo header `X-Auth-Token`. **Elegida como fuente principal.**
- **API-Football (api-sports.io)**: plan gratis de 100 llamadas/día, con guía oficial para Mundial 2026 (`league=1&season=2026`). Es una alternativa válida, pero el tope diario es más ajustado si en el futuro se quiere refrescar más seguido o agregar funciones (ej. botón "sincronizar ahora" en el panel admin).
- **openfootball/worldcup.json**: dataset público en GitHub, sin API key, pero el mantenedor actualiza a mano ~1 vez al día. Se usa como **proveedor de respaldo** detrás del mismo adaptador (intercambiable por variable de entorno `FIXTURES_PROVIDER=openfootball`), útil si football-data.org cae o se agota una cuenta gratuita.

Toda la integración vive detrás de un adaptador (`server/src/services/fixturesProvider`) con una interfaz común `FixturesProvider.fetchFixtures(): Promise<NormalizedFixture[]>`. Cambiar de fuente es cambiar una variable de entorno, no tocar rutas, sync ni frontend.

### Mapeo de fases (rounds)

football-data.org expone el campo `stage` en sus partidos. Para el Mundial 2026 (48 equipos) se asume el siguiente mapeo hacia nuestro enum `Round`:

| `stage` de la API (asumido) | `Round` interno | Ronda en español |
|---|---|---|
| `ROUND_OF_32` | `ROUND_32` | Dieciseisavos de Final |
| `ROUND_OF_16` / `LAST_16` | `ROUND_16` | Octavos de Final |
| `QUARTER_FINALS` | `QUARTERFINAL` | Cuartos de Final |
| `SEMI_FINALS` | `SEMIFINAL` | Semifinal |
| `THIRD_PLACE` | `THIRD_PLACE` | Partido por el tercer lugar |
| `FINAL` | `FINAL` | Final |

**Importante:** el nombre exacto del valor `stage` para la ronda de 32 es una suposición razonable (el formato de 48 equipos es nuevo en 2026 y no hay documentación verificada al momento de escribir esto). El mapeo está centralizado en `server/src/services/fixturesProvider/footballDataProvider.ts` (`STAGE_TO_ROUND`) — si la API real usa otro string, **se corrige en un solo lugar**. Cualquier `stage` no reconocido se registra como advertencia en el `SyncLog` y el partido se omite (no rompe la corrida).

## Modelo de datos (Postgres, ver `server/db/schema.sql`)

```
players      id (uuid), name (unique), created_at
matches      id (uuid), external_id (unique, nullable), round (check enum),
             home_team, away_team, kickoff (UTC), home_score, away_score,
             status (SCHEDULED|FINISHED), manually_fixed (bool),
             source (SEED|SYNC|MANUAL), created_at, updated_at
predictions  id (uuid), player_id, match_id, home_score, away_score,
             created_at, updated_at — UNIQUE (player_id, match_id)
settings     id=1 (singleton), exact_score_points (default 3), result_only_points (default 1)
sync_log     id (uuid), ran_at, success, new_matches, updated_matches, warnings, error_message
```

Sin ORM: las consultas viven en `server/src/repo.ts`, tipadas a mano contra las filas de `pg`. `server/db/migrate.ts` aplica `schema.sql` (idempotente, `CREATE TABLE IF NOT EXISTS`).

Decisiones clave:

- **`externalId` nullable + único**: los partidos semilla (Ronda de 32 ya confirmados a mano) se cargan sin `externalId`. El job de sync los "reclama" cuando encuentra el fixture real de la fuente externa, comparando equipos normalizados (ver abajo) + ronda, y le asigna el `externalId` real — desde ahí el emparejamiento es por ID estable, no por nombre.
- **`manuallyFixed`**: si el organizador corrige un resultado a mano, este flag se pone en `true` y el sync nunca vuelve a tocar `homeScore`/`awayScore`/`status` de ese partido (sólo podría actualizar metadata como el kickoff si cambiara, pero no el resultado).
- **Predicciones nunca se tocan en el sync**: el merge de fixtures sólo escribe en la tabla `Match`; no hay ninguna ruta de código donde el sync lea o escriba `Prediction`.
- **Normalización de equipos**: se guarda el nombre del equipo en español (para mostrar) pero el emparejamiento usa `normalizeTeamName()` (minúsculas, sin tildes) sobre la traducción inglés→español del diccionario `teams.ts`, así "Ivory Coast" (API) calza con "Costa de Marfil" (semilla) sin depender de IDs de equipo de la fuente externa.

## Reglas de puntaje

Configurable en `Settings`, default 3 / 1 / 0. Lógica pura en `services/scoring.ts`:

1. Marcador exacto → `exactScorePoints`.
2. Mismo resultado (signo de la diferencia de goles: gana local / empate / gana visita) pero marcador distinto → `resultOnlyPoints`.
3. Resultado distinto → 0.

## Mecánica "a ciegas hasta el pitazo"

No requiere un job aparte: es una condición de lectura evaluada en cada request. `GET /api/matches` calcula `revealed = now >= match.kickoff` por partido:

- Si `revealed === false`: la respuesta incluye sólo `predictionsSubmittedCount` y, si el jugador autenticado ya pronosticó, su propio pronóstico (para poder editarlo) — nunca los pronósticos de otros.
- Si `revealed === true`: incluye todos los pronósticos de todos los jugadores para ese partido.

No hay caché de "se reveló" en la DB: como el cálculo depende de `now()`, no puede quedar desincronizado ni requiere backfill.

## Identidad de participantes

Sin contraseñas. Al crear/elegir nombre, el backend devuelve un `playerId` (uuid) que el cliente guarda en `localStorage` y reenvía como header `x-player-id` en cada request. No es un mecanismo de seguridad fuerte (no lo necesita un grupo de confianza <10 personas) — es sólo identidad declarativa, igual que el artifact original.

El panel de administración sí pide una contraseña compartida simple: el middleware `requireAdmin` compara el header `x-admin-password` contra `ADMIN_PASSWORD` (variable de entorno, sin hash — no hay tabla de usuarios admin que proteger), para que cargar resultados manuales o cambiar puntajes no quede abierto a cualquiera con el link.

## Despliegue

- **Base de datos**: Postgres gratis en [Neon](https://neon.tech) o [Supabase](https://supabase.com) (sin tarjeta de crédito). Connection string en `DATABASE_URL`.
- **Backend**: Render *Web Service* (free tier), build command `npm install && npm run build`, start command `npm run migrate && npm run start`. `npm run migrate` aplica `db/schema.sql` (idempotente, `CREATE TABLE IF NOT EXISTS`), así que puede correr en cada deploy sin riesgo. El cron de sync corre dentro del mismo proceso (`node-cron`), por lo que el free tier de Render (que duerme tras 15 min sin tráfico) puede saltarse corridas mientras está dormido — aceptable para una polla de amigos; si se quiere 100% confiable, mover el sync a un Render *Cron Job* separado que llame a un endpoint protegido, o pasar a un plan pago siempre activo (~US$7/mes).
- **Frontend**: Render *Static Site* (o Vercel/Netlify) sirviendo el build de Vite, con `VITE_API_URL` apuntando al backend.
- Variables de entorno: ver `.env.example` en `server/` y `client/`.
