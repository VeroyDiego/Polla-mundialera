import { teamMatchKey, translateToSpanish } from "../teams.js";
import type { NormalizedFixture, Round } from "./fixturesProvider/types.js";

export type MatchStatus = "SCHEDULED" | "FINISHED";

/** Subconjunto de campos de `Match` que la lógica de merge necesita leer. */
export interface ExistingMatchRecord {
  id: string;
  externalId: string | null;
  round: Round;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  manuallyFixed: boolean;
}

export interface MatchCreateData {
  externalId: string;
  round: Round;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  source: "SYNC";
}

export interface MatchUpdateData {
  externalId?: string;
  kickoff?: Date;
  homeScore?: number;
  awayScore?: number;
  status?: MatchStatus;
  source?: "SYNC";
}

export interface MatchUpdate {
  id: string;
  data: MatchUpdateData;
}

export interface SyncPlan {
  creates: MatchCreateData[];
  updates: MatchUpdate[];
  warnings: string[];
}

function teamPairKey(homeKey: string, awayKey: string): string {
  return [homeKey, awayKey].sort().join("|");
}

/**
 * Calcula qué hay que crear/actualizar para reflejar los fixtures entrantes,
 * sin tocar la base de datos. Pura y determinística para poder testearla
 * exhaustivamente: idempotencia, no duplicar, no pisar resultados fijados
 * a mano y no tocar nunca la tabla de predicciones (que ni siquiera es un
 * parámetro de esta función).
 */
export function computeSyncPlan(existing: ExistingMatchRecord[], fixtures: NormalizedFixture[]): SyncPlan {
  const creates: MatchCreateData[] = [];
  const updates: MatchUpdate[] = [];
  const warnings: string[] = [];

  const byExternalId = new Map<string, ExistingMatchRecord>();
  const unclaimed = new Map<string, ExistingMatchRecord[]>();

  for (const match of existing) {
    if (match.externalId) {
      byExternalId.set(match.externalId, match);
    } else {
      const key = `${match.round}:${teamPairKey(teamMatchKey(match.homeTeam), teamMatchKey(match.awayTeam))}`;
      const bucket = unclaimed.get(key) ?? [];
      bucket.push(match);
      unclaimed.set(key, bucket);
    }
  }

  // Si dos fixtures distintos reclamaran el mismo partido sin externalId, sólo el primero
  // gana; se registra para no perder el dato silenciosamente.
  const claimedUnclaimedIds = new Set<string>();

  for (const fixture of fixtures) {
    const direct = byExternalId.get(fixture.externalId);
    const candidate = direct ?? findUnclaimedCandidate(fixture, unclaimed, claimedUnclaimedIds);

    if (!candidate) {
      creates.push({
        externalId: fixture.externalId,
        round: fixture.round,
        homeTeam: translateToSpanish(fixture.homeTeam),
        awayTeam: translateToSpanish(fixture.awayTeam),
        kickoff: fixture.kickoff,
        status: fixture.status,
        homeScore: fixture.homeScore ?? null,
        awayScore: fixture.awayScore ?? null,
        source: "SYNC"
      });
      continue;
    }

    if (!direct) claimedUnclaimedIds.add(candidate.id);

    const data: MatchUpdateData = {};

    if (!candidate.externalId) {
      data.externalId = fixture.externalId;
    }

    if (candidate.kickoff.getTime() !== fixture.kickoff.getTime()) {
      data.kickoff = fixture.kickoff;
    }

    if (candidate.manuallyFixed) {
      // El organizador ya corrigió este partido a mano: el resultado/estado no se toca.
    } else if (
      fixture.status === "FINISHED" &&
      fixture.homeScore !== undefined &&
      fixture.awayScore !== undefined &&
      (candidate.status !== "FINISHED" ||
        candidate.homeScore !== fixture.homeScore ||
        candidate.awayScore !== fixture.awayScore)
    ) {
      data.homeScore = fixture.homeScore;
      data.awayScore = fixture.awayScore;
      data.status = "FINISHED";
      data.source = "SYNC";
    }
    // Nunca se baja un partido de FINISHED a SCHEDULED, ni se borra/tocan predicciones.

    if (Object.keys(data).length > 0) {
      updates.push({ id: candidate.id, data });
    }
  }

  return { creates, updates, warnings };
}

function findUnclaimedCandidate(
  fixture: NormalizedFixture,
  unclaimed: Map<string, ExistingMatchRecord[]>,
  claimedIds: Set<string>
): ExistingMatchRecord | undefined {
  const key = `${fixture.round}:${teamPairKey(teamMatchKey(fixture.homeTeam), teamMatchKey(fixture.awayTeam))}`;
  const bucket = unclaimed.get(key);
  if (!bucket) return undefined;
  return bucket.find((match) => !claimedIds.has(match.id));
}
