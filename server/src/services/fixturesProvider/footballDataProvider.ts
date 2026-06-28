import type { FixturesProvider, FixtureStatus, NormalizedFixture, Round } from "./types.js";

/**
 * Mapeo del campo `stage` de football-data.org hacia nuestro enum interno.
 * El valor para la ronda de 32 (nueva en el formato de 48 equipos de 2026)
 * es una suposición razonable a falta de documentación verificada — ver
 * ARCHITECTURE.md. Si la API real usa otro string, se corrige aquí.
 */
const STAGE_TO_ROUND: Record<string, Round> = {
  ROUND_OF_32: "ROUND_32",
  ROUND_OF_16: "ROUND_16",
  LAST_16: "ROUND_16",
  QUARTER_FINALS: "QUARTERFINAL",
  SEMI_FINALS: "SEMIFINAL",
  THIRD_PLACE: "THIRD_PLACE",
  FINAL: "FINAL"
};

const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);
const IGNORED_STATUSES = new Set(["CANCELLED", "POSTPONED", "SUSPENDED"]);

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
    let missingTeams = 0;

    for (const match of body.matches) {
      stageCounts.set(match.stage, (stageCounts.get(match.stage) ?? 0) + 1);

      if (IGNORED_STATUSES.has(match.status)) continue;

      const round = STAGE_TO_ROUND[match.stage];
      if (!round) {
        unknownStages.add(match.stage);
        continue;
      }

      const homeTeam = match.homeTeam?.name ?? match.homeTeam?.shortName;
      const awayTeam = match.awayTeam?.name ?? match.awayTeam?.shortName;
      if (!homeTeam || !awayTeam) {
        missingTeams += 1;
        continue;
      }

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

    // Diagnóstico: si no salió nada utilizable (o hubo rondas no reconocidas),
    // registramos en el SyncLog qué devolvió realmente la API (cuántos partidos y
    // con qué nombres de `stage`), para poder ajustar el mapeo de un vistazo. En
    // operación normal (todo reconocido y con partidos) no agrega ruido.
    if (fixtures.length === 0 || unknownStages.size > 0) {
      const stageBreakdown =
        [...stageCounts.entries()].map(([stage, count]) => `${stage}: ${count}`).join(", ") || "ninguno";
      const unknownNote =
        unknownStages.size > 0 ? `. Rondas no reconocidas: ${[...unknownStages].join(", ")}` : "";
      this.options.onWarning?.(
        `football-data devolvió ${body.matches.length} partido(s) [${stageBreakdown}]; ${fixtures.length} utilizable(s)${unknownNote}`
      );
    }
    if (missingTeams > 0) {
      this.options.onWarning?.(`${missingTeams} partido(s) sin nombre de equipo, omitidos.`);
    }

    return fixtures;
  }
}
