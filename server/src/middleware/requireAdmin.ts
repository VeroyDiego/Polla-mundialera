import type { NextFunction, Request, Response } from "express";
import { env } from "../env.js";

/** Protección simple del panel de organizador: contraseña compartida por variable de entorno. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const password = req.header("x-admin-password");
  if (!password || password !== env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Contraseña de organizador inválida." });
    return;
  }
  next();
}
