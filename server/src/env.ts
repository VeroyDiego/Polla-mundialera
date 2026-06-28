import process from "node:process";
import fs from "node:fs";

// Carga server/.env si existe (Node 20.6+ trae loadEnvFile nativo).
// En producción las variables ya vienen inyectadas por la plataforma de hosting.
if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: required("DATABASE_URL"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  ADMIN_PASSWORD: required("ADMIN_PASSWORD", "cambia-esta-clave"),
  FIXTURES_PROVIDER: (process.env.FIXTURES_PROVIDER ?? "football-data") as
    | "football-data"
    | "openfootball",
  FOOTBALL_DATA_API_TOKEN: process.env.FOOTBALL_DATA_API_TOKEN ?? "",
  FOOTBALL_DATA_COMPETITION_CODE: process.env.FOOTBALL_DATA_COMPETITION_CODE ?? "WC",
  SYNC_INTERVAL_MINUTES: Number(process.env.SYNC_INTERVAL_MINUTES ?? 45)
};
