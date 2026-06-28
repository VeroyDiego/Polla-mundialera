import { Router } from "express";
import { z } from "zod";
import { createPlayer, findPlayerByNameInsensitive, listPlayers } from "../repo.js";

export const playersRouter = Router();

playersRouter.get("/", async (_req, res) => {
  const players = await listPlayers();
  res.json(players);
});

const createPlayerSchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío").max(40)
});

playersRouter.post("/", async (req, res) => {
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Nombre inválido" });
    return;
  }

  const name = parsed.data.name;
  const existing = await findPlayerByNameInsensitive(name);
  if (existing) {
    res.json(existing);
    return;
  }

  const created = await createPlayer(name);
  res.status(201).json(created);
});
