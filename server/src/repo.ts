import { pool } from "./db.js";
import type { ExistingMatchRecord, MatchCreateData, MatchStatus, MatchUpdateData } from "./services/sync.js";
import type { Round } from "./services/fixturesProvider/types.js";

export interface PlayerRow {
  id: string;
  name: string;
}

export interface MatchRow {
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
  source: "SEED" | "SYNC" | "MANUAL";
}

export interface PredictionEntry {
  playerId: string;
  playerName: string;
  homeScore: number;
  awayScore: number;
}

function mapMatchRow(row: any): MatchRow {
  return {
    id: row.id,
    externalId: row.external_id,
    round: row.round,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoff: row.kickoff,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    manuallyFixed: row.manually_fixed,
    source: row.source
  };
}

// --- Players -----------------------------------------------------------

export async function listPlayers(): Promise<PlayerRow[]> {
  const { rows } = await pool.query("SELECT id, name FROM players ORDER BY name ASC");
  return rows;
}

export async function countPlayers(): Promise<number> {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM players");
  return rows[0].count;
}

export async function findPlayerById(id: string): Promise<PlayerRow | null> {
  const { rows } = await pool.query("SELECT id, name FROM players WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findPlayerByNameInsensitive(name: string): Promise<PlayerRow | null> {
  const { rows } = await pool.query("SELECT id, name FROM players WHERE lower(name) = lower($1)", [name]);
  return rows[0] ?? null;
}

export async function createPlayer(name: string): Promise<PlayerRow> {
  const { rows } = await pool.query("INSERT INTO players (name) VALUES ($1) RETURNING id, name", [name]);
  return rows[0];
}

export async function renamePlayer(id: string, name: string): Promise<PlayerRow> {
  const { rows } = await pool.query("UPDATE players SET name = $2 WHERE id = $1 RETURNING id, name", [id, name]);
  return rows[0];
}

export async function deletePlayer(id: string): Promise<void> {
  await pool.query("DELETE FROM players WHERE id = $1", [id]);
}

export async function listPlayersWithPredictionCounts(): Promise<Array<PlayerRow & { predictionsCount: number }>> {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, COUNT(pr.id)::int AS predictions_count
    FROM players p
    LEFT JOIN predictions pr ON pr.player_id = p.id
    GROUP BY p.id, p.name
    ORDER BY p.name ASC
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, predictionsCount: r.predictions_count }));
}

// --- Matches -------------------------------------------------------------

export async function listMatchesWithPredictions(): Promise<{ matches: MatchRow[]; predictionsByMatch: Map<string, PredictionEntry[]> }> {
  const matchesResult = await pool.query("SELECT * FROM matches ORDER BY kickoff ASC");
  const predictionsResult = await pool.query(`
    SELECT pr.match_id, pr.player_id, pl.name AS player_name, pr.home_score, pr.away_score
    FROM predictions pr
    JOIN players pl ON pl.id = pr.player_id
  `);

  const predictionsByMatch = new Map<string, PredictionEntry[]>();
  for (const row of predictionsResult.rows) {
    const list = predictionsByMatch.get(row.match_id) ?? [];
    list.push({
      playerId: row.player_id,
      playerName: row.player_name,
      homeScore: row.home_score,
      awayScore: row.away_score
    });
    predictionsByMatch.set(row.match_id, list);
  }

  return { matches: matchesResult.rows.map(mapMatchRow), predictionsByMatch };
}

export async function findMatchById(id: string): Promise<MatchRow | null> {
  const { rows } = await pool.query("SELECT * FROM matches WHERE id = $1", [id]);
  return rows[0] ? mapMatchRow(rows[0]) : null;
}

export async function listAllMatchesForSync(): Promise<ExistingMatchRecord[]> {
  const { rows } = await pool.query("SELECT * FROM matches");
  return rows.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    round: row.round,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoff: row.kickoff,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    manuallyFixed: row.manually_fixed
  }));
}

export async function createMatchFromSync(data: MatchCreateData): Promise<void> {
  await pool.query(
    `INSERT INTO matches (external_id, round, home_team, away_team, kickoff, status, home_score, away_score, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [data.externalId, data.round, data.homeTeam, data.awayTeam, data.kickoff, data.status, data.homeScore, data.awayScore, data.source]
  );
}

export async function updateMatchFromSync(id: string, data: MatchUpdateData): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  if (data.externalId !== undefined) set("external_id", data.externalId);
  if (data.kickoff !== undefined) set("kickoff", data.kickoff);
  if (data.homeScore !== undefined) set("home_score", data.homeScore);
  if (data.awayScore !== undefined) set("away_score", data.awayScore);
  if (data.status !== undefined) set("status", data.status);
  if (data.source !== undefined) set("source", data.source);

  if (sets.length === 0) return;

  sets.push("updated_at = now()");
  values.push(id);
  await pool.query(`UPDATE matches SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
}

export async function updateMatchManualResult(id: string, homeScore: number, awayScore: number): Promise<MatchRow> {
  const { rows } = await pool.query(
    `UPDATE matches
     SET home_score = $2, away_score = $3, status = 'FINISHED', manually_fixed = true, source = 'MANUAL', updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, homeScore, awayScore]
  );
  return mapMatchRow(rows[0]);
}

export async function listFinishedMatchesWithPredictions(): Promise<
  Array<{ homeScore: number; awayScore: number; predictions: Array<{ playerId: string; homeScore: number; awayScore: number }> }>
> {
  const { rows } = await pool.query(`
    SELECT m.id, m.home_score, m.away_score, pr.player_id, pr.home_score AS pred_home, pr.away_score AS pred_away
    FROM matches m
    LEFT JOIN predictions pr ON pr.match_id = m.id
    WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  `);

  const byMatch = new Map<string, { homeScore: number; awayScore: number; predictions: Array<{ playerId: string; homeScore: number; awayScore: number }> }>();
  for (const row of rows) {
    const entry = byMatch.get(row.id) ?? {
      homeScore: row.home_score,
      awayScore: row.away_score,
      predictions: [] as Array<{ playerId: string; homeScore: number; awayScore: number }>
    };
    if (row.player_id) {
      entry.predictions.push({ playerId: row.player_id, homeScore: row.pred_home, awayScore: row.pred_away });
    }
    byMatch.set(row.id, entry);
  }
  return [...byMatch.values()];
}

// --- Predictions ---------------------------------------------------------

export async function upsertPrediction(
  playerId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ homeScore: number; awayScore: number }> {
  const { rows } = await pool.query(
    `INSERT INTO predictions (player_id, match_id, home_score, away_score)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, match_id)
     DO UPDATE SET home_score = $3, away_score = $4, updated_at = now()
     RETURNING home_score, away_score`,
    [playerId, matchId, homeScore, awayScore]
  );
  return { homeScore: rows[0].home_score, awayScore: rows[0].away_score };
}

// --- Settings -------------------------------------------------------------

export interface SettingsRow {
  exactScorePoints: number;
  resultOnlyPoints: number;
}

export async function getSettings(): Promise<SettingsRow> {
  const { rows } = await pool.query("SELECT exact_score_points, result_only_points FROM settings WHERE id = 1");
  return { exactScorePoints: rows[0].exact_score_points, resultOnlyPoints: rows[0].result_only_points };
}

export async function updateSettings(data: SettingsRow): Promise<SettingsRow> {
  const { rows } = await pool.query(
    `UPDATE settings SET exact_score_points = $1, result_only_points = $2 WHERE id = 1
     RETURNING exact_score_points, result_only_points`,
    [data.exactScorePoints, data.resultOnlyPoints]
  );
  return { exactScorePoints: rows[0].exact_score_points, resultOnlyPoints: rows[0].result_only_points };
}

// --- Sync log -------------------------------------------------------------

export interface SyncLogRow {
  id: string;
  ranAt: Date;
  success: boolean;
  newMatches: number;
  updatedMatches: number;
  warnings: string | null;
  errorMessage: string | null;
}

export async function insertSyncLog(data: {
  success: boolean;
  newMatches: number;
  updatedMatches: number;
  warnings: string | null;
  errorMessage: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO sync_log (success, new_matches, updated_matches, warnings, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.success, data.newMatches, data.updatedMatches, data.warnings, data.errorMessage]
  );
}

export async function listSyncLogs(limit = 10): Promise<SyncLogRow[]> {
  const { rows } = await pool.query("SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT $1", [limit]);
  return rows.map((r) => ({
    id: r.id,
    ranAt: r.ran_at,
    success: r.success,
    newMatches: r.new_matches,
    updatedMatches: r.updated_matches,
    warnings: r.warnings,
    errorMessage: r.error_message
  }));
}
