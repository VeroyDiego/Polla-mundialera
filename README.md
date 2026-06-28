# Polla Mundial 26

App privada para que un grupo de amigos (≤10 personas) pronostique los resultados de la fase eliminatoria del Mundial 2026. Ver el detalle de decisiones de diseño en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Estructura

```
server/   Backend Node.js + Express + TypeScript + PostgreSQL (pg)
client/   Frontend React + Vite + TypeScript
```

## Requisitos

- Node.js 20+ (usa `process.loadEnvFile`, disponible desde Node 20.6)
- PostgreSQL (local, o gratis en [Neon](https://neon.tech)/[Supabase](https://supabase.com))

## Backend (`server/`)

### Configuración

```bash
cd server
npm install
cp .env.example .env
```

Variables de entorno (`server/.env`):

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de Postgres, ej. `postgresql://user:pass@host:5432/db` |
| `PORT` | Puerto del backend (default `4000`) |
| `CLIENT_ORIGIN` | Origen permitido por CORS, ej. `http://localhost:5173` |
| `ADMIN_PASSWORD` | Contraseña compartida para el panel de administración |
| `FIXTURES_PROVIDER` | `football-data` (default) u `openfootball` |
| `FOOTBALL_DATA_API_TOKEN` | Token de [football-data.org](https://www.football-data.org/client/register) (gratis) — requerido si `FIXTURES_PROVIDER=football-data` |
| `FOOTBALL_DATA_COMPETITION_CODE` | Código de competencia en football-data.org (default `WC`) |
| `SYNC_INTERVAL_MINUTES` | Cada cuántos minutos corre el job de sincronización (default `45`) |

### Base de datos

```bash
npm run migrate   # aplica server/db/schema.sql (idempotente)
npm run seed      # carga los 10 partidos confirmados de Dieciseisavos
```

### Correr en desarrollo

```bash
npm run dev
```

El servidor levanta en `http://localhost:4000` y agenda el job de sincronización con `node-cron` cada `SYNC_INTERVAL_MINUTES` minutos.

### Otros comandos

```bash
npm test        # vitest (scoring + sync merge logic)
npm run typecheck
npm run build    # compila a dist/
npm run start    # corre dist/server.js (producción)
```

### Cambiar la fuente de datos de partidos

Toda la integración externa vive detrás de un adaptador (`src/services/fixturesProvider`). Para cambiar de fuente sólo se modifica `FIXTURES_PROVIDER` en `.env` — no hay que tocar rutas, el job de sync ni el frontend. Ver el detalle de por qué se eligió football-data.org (y openfootball como respaldo) en `ARCHITECTURE.md`.

### Cambiar el intervalo de sincronización

Ajustar `SYNC_INTERVAL_MINUTES` en `.env` y reiniciar el servidor. También se puede forzar una corrida inmediata desde el panel de administración (botón "Sincronizar ahora", que llama a `POST /api/admin/sync/run`).

## Frontend (`client/`)

### Configuración

```bash
cd client
npm install
cp .env.example .env   # ajustar VITE_API_URL si el backend no corre en localhost:4000
```

### Correr en desarrollo

```bash
npm run dev
```

Levanta en `http://localhost:5173`.

### Build de producción

```bash
npm run build     # genera dist/
npm run preview   # sirve el build localmente para probarlo
```

## Identidad de participantes

Sin contraseñas: cada persona elige su nombre (o crea uno nuevo) la primera vez y el navegador guarda un `playerId` en `localStorage`. El panel de administración (pestaña "Admin") sí pide la contraseña compartida (`ADMIN_PASSWORD`).

## Mecánica "a ciegas hasta el pitazo"

Los pronósticos de los demás participantes permanecen ocultos hasta el horario de inicio (kickoff) de cada partido — sólo se ve la cantidad de gente que ya pronosticó. Al llegar la hora de inicio se revelan automáticamente, sin necesidad de recargar nada del lado del servidor (es un cálculo en cada request, no un job aparte).

## Despliegue (sugerido, gratis) — un solo servicio

En producción el backend Express sirve **también** el frontend ya compilado (mismo
origen). Eso significa **un solo servicio que desplegar**, sin CORS ni una segunda
URL que coordinar. El `package.json` raíz orquesta todo y hay un `render.yaml` listo.

1. **Base de datos**: crear un proyecto Postgres gratis en Neon o Supabase y copiar el `DATABASE_URL`.
2. **Crear las tablas**: aplicar `server/db/schema.sql` una vez. La forma más simple sin
   terminal es pegarlo en el *SQL Editor* del panel de Neon/Supabase. (En el deploy también
   se aplica solo: el *start command* corre `npm run migrate`, que es idempotente.)
3. **Servicio web** en Render (free tier), opción **Blueprint** (lee `render.yaml`) o manual:
   - Build command: `npm run build`  *(compila frontend y backend)*
   - Start command: `npm run migrate && npm run start`
   - Health check path: `/api/health`
   - Variables de entorno (secretas, cargar a mano): `DATABASE_URL`, `ADMIN_PASSWORD`,
     `FOOTBALL_DATA_API_TOKEN`. Las no-secretas (`FIXTURES_PROVIDER`, `FOOTBALL_DATA_COMPETITION_CODE`,
     `SYNC_INTERVAL_MINUTES`) ya vienen en `render.yaml`.
4. **Cargar los partidos semilla**: correr `npm run seed` una vez (desde un shell de Render, o
   pegando los `INSERT` de los 10 partidos en el SQL Editor). Es idempotente: no duplica.

> El free tier de Render duerme tras ~15 min sin tráfico y puede saltarse alguna corrida del
> sync mientras duerme — aceptable para una polla de amigos. Para 100% de confiabilidad, ver
> en `ARCHITECTURE.md` la alternativa de un *Cron Job* separado o un plan siempre activo.
