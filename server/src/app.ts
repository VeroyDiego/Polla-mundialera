import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { attachPlayer } from "./middleware/requirePlayer.js";
import { playersRouter } from "./routes/players.js";
import { matchesRouter } from "./routes/matches.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { adminRouter } from "./routes/admin.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json());
  app.use(attachPlayer);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/players", playersRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/admin", adminRouter);

  return app;
}
