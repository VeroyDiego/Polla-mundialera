import { Router } from "express";
import { z } from "zod";
import { countPlayers, findMatchById, listMatchesWithPredictions, upsertPrediction } from "../repo.js";
import { requirePlayer } from "../middleware/requirePlayer.js";

export const matchesRouter = Router();

matchesRouter.get("/", async (req, res) => {
  const now = new Date();
  const [{ matches, predictionsByMatch }, totalPlayers] = await Promise.all([
    listMatchesWithPredictions(),
    countPlayers()
  ]);

  const payload = matches.map((match) => {
    const revealed = now.getTime() >= match.kickoff.getTime();
    const matchPredictions = predictionsByMatch.get(match.id) ?? [];
    const mine = req.player ? matchPredictions.find((p) => p.playerId === req.player!.id) : undefined;

    return {
      id: match.id,
      round: match.round,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffUtc: match.kickoff.toISOString(),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      manuallyFixed: match.manuallyFixed,
      revealed,
      predictionsSubmittedCount: matchPredictions.length,
      totalPlayers,
      myPrediction: mine ? { homeScore: mine.homeScore, awayScore: mine.awayScore } : null,
      predictions: revealed
        ? matchPredictions.map((p) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            homeScore: p.homeScore,
            awayScore: p.awayScore
          }))
        : undefined
    };
  });

  res.json(payload);
});

const predictionSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99)
});

matchesRouter.put("/:id/prediction", requirePlayer, async (req, res) => {
  const parsed = predictionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Marcador inválido" });
    return;
  }

  const match = await findMatchById(req.params.id);
  if (!match) {
    res.status(404).json({ error: "Partido no encontrado" });
    return;
  }

  if (Date.now() >= match.kickoff.getTime()) {
    res.status(409).json({ error: "Este partido ya empezó: no se puede pronosticar." });
    return;
  }

  const prediction = await upsertPrediction(req.player!.id, match.id, parsed.data.homeScore, parsed.data.awayScore);
  res.json(prediction);
});
