import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { runSync } from "../jobs/syncJob.js";
import {
  deletePlayer,
  getSettings,
  listPlayersWithPredictionCounts,
  listSyncLogs,
  renamePlayer,
  updateMatchManualResult,
  updateSettings
} from "../repo.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/settings", async (_req, res) => {
  res.json(await getSettings());
});

const settingsSchema = z.object({
  exactScorePoints: z.number().int().min(0).max(100),
  resultOnlyPoints: z.number().int().min(0).max(100)
});

adminRouter.put("/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Valores inválidos" });
    return;
  }
  res.json(await updateSettings(parsed.data));
});

adminRouter.get("/players", async (_req, res) => {
  res.json(await listPlayersWithPredictionCounts());
});

const renamePlayerSchema = z.object({ name: z.string().trim().min(1).max(40) });

adminRouter.put("/players/:id", async (req, res) => {
  const parsed = renamePlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Nombre inválido" });
    return;
  }
  res.json(await renamePlayer(req.params.id, parsed.data.name));
});

adminRouter.delete("/players/:id", async (req, res) => {
  await deletePlayer(req.params.id);
  res.status(204).end();
});

const manualResultSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99)
});

adminRouter.put("/matches/:id/result", async (req, res) => {
  const parsed = manualResultSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Marcador inválido" });
    return;
  }
  const match = await updateMatchManualResult(req.params.id, parsed.data.homeScore, parsed.data.awayScore);
  res.json(match);
});

adminRouter.get("/sync-status", async (_req, res) => {
  res.json(await listSyncLogs(10));
});

adminRouter.post("/sync/run", async (_req, res) => {
  res.json(await runSync());
});
