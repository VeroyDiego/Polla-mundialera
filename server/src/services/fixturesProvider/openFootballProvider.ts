import type { FixturesProvider, FixtureStatus, NormalizedFixture, Round } from "./types.js";

/**
 * Proveedor de respaldo: openfootball/worldcup.json (GitHub, sin API key).
 * El mantenedor actualiza el dataset ~1 vez al día, así que no es apto como
 * fuente principal, pero sirve si football-data.org falla o agota su cuota.
 *
 * El formato exacto del archivo de la edición 2026 no estaba publicado al
 * escribir este adaptador, así que el parseo es deliberadamente tolerante
 * (varios alias de nombre de ronda, fechas con u sin hora) y cualquier
 * partido que no se pueda interpretar se omite con una advertencia en vez
 * de tumbar la sincronización. Si el formato real difiere, ajustar sólo
 * `parseRound` / `parseMatch` de este archivo.
 */

const ROUND_ALIASES: Array<{ pattern: RegExp; round: Round }> = [
  { pattern: /round of 32|r32|32/i, round: "ROUND_32" },
  { pattern: /round of 16|last 16|r16/i, round: "ROUND_16" },
  { pattern: /quarter/i, round: "QUARTERFINAL" },
  { pattern: /semi/i, round: "SEMIFINAL" },
  { pattern: /3rd place|third place|bronze/i, round: "THIRD_PLACE" },
  { pattern: /^final$|final\b/i, round: "FINAL" }
];

interface OpenFootballMatch {
  round?: string;
  date?: string;
  time?: string;
  team1?: string;
  team2?: string;
  score1?: number | null;
  score2?: number | null;
  score?: { ft?: [number, number] };
}

interface OpenFootballDocument {
  matches?: OpenFootballMatch[];
  rounds?: Array<{ name?: string; matches?: OpenFootballMatch[] }>;
}

export interface OpenFootballProviderOptions {
  url?: string;
  onWarning?: (message: string) => void;
  timeoutMs?: number;
}

const DEFAULT_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/wc2026.json";

export class OpenFootballProvider implements FixturesProvider {
  readonly name = "openfootball";

  constructor(private readonly options: OpenFootballProviderOptions = {}) {}

  async fetchFixtures(): Promise<NormalizedFixture[]> {
    const { url = DEFAULT_URL, timeoutMs = 10_000 } = this.options;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      throw new Error(`No se pudo contactar openfootball: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`openfootball respondió con status ${response.status}`);
    }

    let doc: OpenFootballDocument;
    try {
      doc = (await response.json()) as OpenFootballDocument;
    } catch {
      throw new Error("openfootball devolvió un cuerpo no-JSON o vacío");
    }

    const flatMatches: Array<{ roundLabel: string; match: OpenFootballMatch }> = [];
    if (Array.isArray(doc.matches)) {
      for (const match of doc.matches) {
        flatMatches.push({ roundLabel: match.round ?? "", match });
      }
    }
    if (Array.isArray(doc.rounds)) {
      for (const roundGroup of doc.rounds) {
        for (const match of roundGroup.matches ?? []) {
          flatMatches.push({ roundLabel: roundGroup.name ?? match.round ?? "", match });
        }
      }
    }

    const fixtures: NormalizedFixture[] = [];
    let index = 0;
    for (const { roundLabel, match } of flatMatches) {
      index += 1;
      const round = parseRound(roundLabel);
      if (!round) continue; // fase de grupos u otra ronda fuera de alcance, se ignora en silencio

      if (!match.team1 || !match.team2 || !match.date) {
        this.options.onWarning?.(`Partido openfootball #${index} incompleto, se omite`);
        continue;
      }

      const kickoff = parseKickoff(match.date, match.time);
      if (!kickoff) {
        this.options.onWarning?.(`Partido openfootball #${index} con fecha inválida, se omite`);
        continue;
      }

      const homeScore = match.score1 ?? match.score?.ft?.[0] ?? undefined;
      const awayScore = match.score2 ?? match.score?.ft?.[1] ?? undefined;
      const status: FixtureStatus = homeScore !== undefined && awayScore !== undefined ? "FINISHED" : "SCHEDULED";

      // openfootball no expone un ID numérico de partido en el JSON; se construye
      // una clave determinística (ronda+equipos+fecha) que es estable entre corridas,
      // que es lo que la idempotencia del sync realmente necesita.
      fixtures.push({
        externalId: `openfootball:${round}:${normalizeKey(match.team1)}:${normalizeKey(match.team2)}:${match.date}`,
        round,
        homeTeam: match.team1,
        awayTeam: match.team2,
        kickoff,
        status,
        homeScore: homeScore ?? undefined,
        awayScore: awayScore ?? undefined
      });
    }

    return fixtures;
  }
}

function parseRound(label: string): Round | null {
  for (const { pattern, round } of ROUND_ALIASES) {
    if (pattern.test(label)) return round;
  }
  return null;
}

function parseKickoff(date: string, time?: string): Date | null {
  const iso = time ? `${date}T${time}Z` : `${date}T00:00:00Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}
