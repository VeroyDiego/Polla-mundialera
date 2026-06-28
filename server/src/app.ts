import "express-async-errors";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { attachPlayer } from "./middleware/requirePlayer.js";
import { playersRouter } from "./routes/players.js";
import { matchesRouter } from "./routes/matches.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { adminRouter } from "./routes/admin.js";

// Ubicación del build del frontend. El server compilado vive en server/dist/, así
// que el dist del cliente queda en ../../client/dist relativo a este archivo.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

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

  // En producción servimos el frontend ya compilado desde el mismo proceso (mismo
  // origen → sin CORS, sin segunda URL). Si no hay build (modo desarrollo, donde
  // Vite sirve el cliente aparte), simplemente no se monta nada de esto.
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    // Fallback SPA: cualquier ruta que no sea /api devuelve index.html para que
    // el router del cliente maneje la navegación.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Manejador de errores final: cualquier excepción en una ruta (ej. un hipo de
  // conexión con la base) se convierte en un 500 y queda registrada, en vez de
  // tumbar todo el proceso. `express-async-errors` (importado arriba) hace que
  // los errores de handlers async lleguen hasta acá.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error no controlado en una ruta:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Error interno del servidor. Intenta de nuevo." });
  });

  return app;
}
