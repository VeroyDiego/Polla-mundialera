export interface ScoreLine {
  homeScore: number;
  awayScore: number;
}

export interface ScoringSettings {
  exactScorePoints: number;
  resultOnlyPoints: number;
}

function outcome(score: ScoreLine): -1 | 0 | 1 {
  return Math.sign(score.homeScore - score.awayScore) as -1 | 0 | 1;
}

/**
 * Marcador exacto -> exactScorePoints.
 * Mismo resultado (gana local / empate / gana visita) sin marcador exacto -> resultOnlyPoints.
 * Resultado distinto -> 0.
 */
export function computePoints(
  prediction: ScoreLine,
  result: ScoreLine,
  settings: ScoringSettings
): number {
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    return settings.exactScorePoints;
  }
  if (outcome(prediction) === outcome(result)) {
    return settings.resultOnlyPoints;
  }
  return 0;
}

export function isExactMatch(prediction: ScoreLine, result: ScoreLine): boolean {
  return prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore;
}

export function isCorrectOutcome(prediction: ScoreLine, result: ScoreLine): boolean {
  return outcome(prediction) === outcome(result);
}
