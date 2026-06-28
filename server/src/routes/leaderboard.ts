import { Router } from "express";
import { getSettings, listFinishedMatchesWithPredictions, listPlayers } from "../repo.js";
import { computePoints, isExactMatch } from "../services/scoring.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (_req, res) => {
  const [settings, players, finishedMatches] = await Promise.all([
    getSettings(),
    listPlayers(),
    listFinishedMatchesWithPredictions()
  ]);

  const stats = new Map(
    players.map((p) => [p.id, { playerId: p.id, playerName: p.name, totalPoints: 0, exactCount: 0, resultOnlyCount: 0, played: 0 }])
  );

  for (const match of finishedMatches) {
    const result = { homeScore: match.homeScore, awayScore: match.awayScore };
    for (const prediction of match.predictions) {
      const entry = stats.get(prediction.playerId);
      if (!entry) continue;
      const points = computePoints(prediction, result, settings);
      entry.totalPoints += points;
      entry.played += 1;
      if (isExactMatch(prediction, result)) {
        entry.exactCount += 1;
      } else if (points > 0) {
        entry.resultOnlyCount += 1;
      }
    }
  }

  const leaderboard = [...stats.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    return a.playerName.localeCompare(b.playerName);
  });

  res.json(leaderboard);
});
