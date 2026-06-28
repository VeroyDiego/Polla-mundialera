import { Router } from "express";
import { getSettings } from "../repo.js";

// Endpoint público de solo-lectura: la página de Reglas necesita mostrar el
// puntaje real configurado (exacto / resultado) sin requerir clave de admin.
export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const settings = await getSettings();
  res.json(settings);
});
