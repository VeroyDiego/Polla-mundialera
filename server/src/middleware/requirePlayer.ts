import type { NextFunction, Request, Response } from "express";
import { findPlayerById } from "../repo.js";

declare module "express-serve-static-core" {
  interface Request {
    player?: { id: string; name: string };
  }
}

/** Adjunta req.player si viene un x-player-id válido; no rechaza la request si falta. */
export async function attachPlayer(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const playerId = req.header("x-player-id");
  if (!playerId) {
    next();
    return;
  }
  const player = await findPlayerById(playerId);
  if (player) {
    req.player = { id: player.id, name: player.name };
  }
  next();
}

export function requirePlayer(req: Request, res: Response, next: NextFunction): void {
  if (!req.player) {
    res.status(401).json({ error: "Falta identificarse: elige tu nombre primero." });
    return;
  }
  next();
}
