export type Round = "ROUND_32" | "ROUND_16" | "QUARTERFINAL" | "SEMIFINAL" | "THIRD_PLACE" | "FINAL";

export interface Player {
  id: string;
  name: string;
}

export interface PredictionView {
  homeScore: number;
  awayScore: number;
}

export interface OtherPrediction {
  playerId: string;
  playerName: string;
  homeScore: number;
  awayScore: number;
}

export interface MatchView {
  id: string;
  round: Round;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  status: "SCHEDULED" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  manuallyFixed: boolean;
  revealed: boolean;
  predictionsSubmittedCount: number;
  totalPlayers: number;
  myPrediction: PredictionView | null;
  predictions?: OtherPrediction[];
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  totalPoints: number;
  exactCount: number;
  resultOnlyCount: number;
  played: number;
}

export interface Settings {
  exactScorePoints: number;
  resultOnlyPoints: number;
}

export interface SyncLogEntry {
  id: string;
  ranAt: string;
  success: boolean;
  newMatches: number;
  updatedMatches: number;
  warnings: string[];
  errorMessage: string | null;
}

export interface PlayerWithCount extends Player {
  predictionCount: number;
}

export const ROUND_LABELS: Record<Round, string> = {
  ROUND_32: "Dieciseisavos de Final",
  ROUND_16: "Octavos de Final",
  QUARTERFINAL: "Cuartos de Final",
  SEMIFINAL: "Semifinal",
  THIRD_PLACE: "Tercer Lugar",
  FINAL: "Final"
};

export const ROUND_ORDER: Round[] = ["ROUND_32", "ROUND_16", "QUARTERFINAL", "SEMIFINAL", "THIRD_PLACE", "FINAL"];
