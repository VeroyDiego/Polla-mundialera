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

    if (response.status === 429) {
      throw new Error("football-data.org devolvió 429 (rate limit excedido)");
    }
    if (!response.ok) {
      throw new Error(`football-data.org respondió con status ${response.status}`);
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
    for (const match of body.matches) {
      if (IGNORED_STATUSES.has(match.status)) continue;

      const round = STAGE_TO_ROUND[match.stage];
      if (!round) {
        this.options.onWarning?.(`Stage desconocido de football-data.org: "${match.stage}" (match id ${match.id})`);
        continue;
      }

      const homeTeam = match.homeTeam?.name ?? match.homeTeam?.shortName;
      const awayTeam = match.awayTeam?.name ?? match.awayTeam?.shortName;
      if (!homeTeam || !awayTeam) {
        this.options.onWarning?.(`Partido ${match.id} sin nombre de equipo, se omite`);
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

    return fixtures;
  }
}
