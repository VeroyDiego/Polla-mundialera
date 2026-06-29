import { PLACEHOLDER_TEAM } from "./types.js";
import type { FixturesProvider, FixtureStatus, NormalizedFixture, Round } from "./types.js";

/**
 * Mapeo del campo `stage` de football-data.org hacia nuestro enum interno.
 * Confirmado contra la API real del Mundial 2026 (formato de 48 equipos):
 * los Dieciseisavos se llaman `LAST_32`. Si la API cambiara un nombre, se
 * corrige acá en un solo lugar.
 */
const STAGE_TO_ROUND: Record<string, Round> = {
  LAST_32: "ROUND_32",
  ROUND_OF_32: "ROUND_32",
  LAST_16: "ROUND_16",
  ROUND_OF_16: "ROUND_16",
  QUARTER_FINALS: "QUARTERFINAL",
  SEMI_FINALS: "SEMIFINAL",
  THIRD_PLACE: "THIRD_PLACE",
  FINAL: "FINAL"
};

const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);
const IGNORED_STATUSES = new Set(["CANCELLED", "POSTPONED", "SUSPENDED"]);
// Fases que no son parte de la polla (eliminatoria): se ignoran en silencio,
// sin marcarlas como "ronda desconocida".
const IGNORED_STAGES = new Set(["GROUP_STAGE", "LEAGUE_STAGE", "PRELIMINARY_ROUND", "PLAYOFFS", "QUALIFICATION"]);

/** Parsea un header numérico; devuelve undefined si falta o no es número. */
function toInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  homeTeam: { name?: string; shortName?: string };
  awayTeam: { name?: string; shortName?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

export interface FootballDataProviderOptions {
  apiToken: string;
  competitionCode: string;
  baseUrl?: string;
  /** Recibe avisos no fatales (ej. stage desconocido) para que el caller los registre en el SyncLog. */
  onWarning?: (message: string) => void;
  timeoutMs?: number;
}

export class FootballDataProvider implements FixturesProvider {
  readonly name = "football-data";

  constructor(private readonly options: FootballDataProviderOptions) {}

  async fetchFixtures(): Promise<NormalizedFixture[]> {
    const { apiToken, competitionCode, baseUrl = "https://api.football-data.org/v4", timeoutMs = 10_000 } =
      this.options;

    if (!apiToken) {
      throw new Error("FOOTBALL_DATA_API_TOKEN no está configurado");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/competitions/${competitionCode}/matches`, {
        headers: { "X-Auth-Token": apiToken },
        signal: controller.signal
      });
    } catch (err) {
      throw new Error(`No se pudo contactar football-data.org: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    // football-data.org expone el estado del rate limit en los headers de cada
    // respuesta. Los leemos para avisar antes de chocar con el límite (free tier:
    // 10 req/min) y para dar un tiempo de espera útil cuando devuelve 429.
    const remaining = toInt(response.headers.get("X-Requests-Available-Minute"));
    const resetSeconds = toInt(response.headers.get("X-RequestCounter-Reset"));

    if (response.status === 429) {
      const waitHint = resetSeconds !== undefined ? ` Reintentar en ~${resetSeconds}s.` : "";
      throw new Error(`football-data.org devolvió 429 (rate limit excedido).${waitHint}`);
    }
    if (!response.ok) {
      throw new Error(`football-data.org respondió con status ${response.status}`);
    }

    if (remaining !== undefined && remaining <= 1) {
      const resetHint = resetSeconds !== undefined ? ` (se reinicia en ~${resetSeconds}s)` : "";
      this.options.onWarning?.(
        `Cuota de football-data.org casi agotada este minuto: quedan ${remaining} llamada(s)${resetHint}.`
      );
    }

    let body: FootballDataResponse;
    try {
      body = (await response.json()) as FootballDataResponse;
    } catch {
      throw new Error("football-data.org devolvió un cuerpo no-JSON o vacío");
    }

    if (!body || !Array.isArray(body.matches)) {
      throw new Error("football-data.org devolvió una respuesta sin el campo 'matches'");
    }

    const fixtures: NormalizedFixture[] = [];
    const stageCounts = new Map<string, number>();
    const unknownStages = new Set<string>();

    for (const match of body.matches) {
      stageCounts.set(match.stage, (stageCounts.get(match.stage) ?? 0) + 1);

      if (IGNORED_STATUSES.has(match.status)) continue;
      if (IGNORED_STAGES.has(match.stage)) continue;

      const round = STAGE_TO_ROUND[match.stage];
      if (!round) {
        unknownStages.add(match.stage);
        continue;
      }

      // Partidos de la llave cuyos equipos aún no se definen entran igual, con
      // nombre provisional. La fuente externa los completa en sincronizaciones
      // posteriores (el emparejamiento es por externalId estable).
      const homeTeam = match.homeTeam?.name ?? match.homeTeam?.shortName ?? PLACEHOLDER_TEAM;
      const awayTeam = match.awayTeam?.name ?? match.awayTeam?.shortName ?? PLACEHOLDER_TEAM;

      const status: FixtureStatus = FINISHED_STATUSES.has(match.status) ? "FINISHED" : "SCHEDULED";

      fixtures.push({
        externalId: `football-data:${match.id}`,
        round,
        homeTeam,
        awayTeam,
        kickoff: new Date(match.utcDate),
        status,
        homeScore: match.score?.fullTime?.home ?? undefined,
        awayScore: match.score?.fullTime?.away ?? undefined
      });
    }

    // Diagnóstico: sólo si aparece una ronda que no sabemos mapear (algo
    // inesperado de la API). En operación normal no agrega ruido.
    if (unknownStages.size > 0) {
      const stageBreakdown =
        [...stageCounts.entries()].map(([stage, count]) => `${stage}: ${count}`).join(", ") || "ninguno";
      this.options.onWarning?.(
        `football-data devolvió ${body.matches.length} partido(s) [${stageBreakdown}]; ${fixtures.length} utilizable(s). Rondas no reconocidas: ${[...unknownStages].join(", ")}`
      );
    }

    return fixtures;
  }
}
