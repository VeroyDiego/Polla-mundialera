import type { LeaderboardEntry, MatchView, Player, PlayerWithCount, Settings, SyncLogEntry } from "./types";

// En producción el backend sirve también el frontend (mismo origen), así que la
// base queda vacía y las llamadas van a rutas relativas (/api/...). En desarrollo
// se define VITE_API_URL (client/.env) para apuntar al backend en otro puerto.
const API_URL = import.meta.env.VITE_API_URL ?? "";

const PLAYER_ID_KEY = "polla26.playerId";
const ADMIN_PASSWORD_KEY = "polla26.adminPassword";

export function getStoredPlayerId(): string | null {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function setStoredPlayerId(id: string): void {
  localStorage.setItem(PLAYER_ID_KEY, id);
}

export function clearStoredPlayerId(): void {
  localStorage.removeItem(PLAYER_ID_KEY);
}

export function getStoredAdminPassword(): string | null {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY);
}

export function setStoredAdminPassword(password: string): void {
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

export function clearStoredAdminPassword(): void {
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, opts: { admin?: boolean } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const playerId = getStoredPlayerId();
  if (playerId) headers.set("x-player-id", playerId);

  if (opts.admin) {
    const adminPassword = getStoredAdminPassword();
    if (adminPassword) headers.set("x-admin-password", adminPassword);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // respuesta sin cuerpo JSON, se usa el mensaje genérico
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listPlayers: () => request<Player[]>("/api/players"),
  createPlayer: (name: string) => request<Player>("/api/players", { method: "POST", body: JSON.stringify({ name }) }),

  listMatches: () => request<MatchView[]>("/api/matches"),
  savePrediction: (matchId: string, homeScore: number, awayScore: number) =>
    request<unknown>(`/api/matches/${matchId}/prediction`, {
      method: "PUT",
      body: JSON.stringify({ homeScore, awayScore })
    }),

  getLeaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),
  getSettings: () => request<Settings>("/api/settings"),

  adminGetSettings: () => request<Settings>("/api/admin/settings", {}, { admin: true }),
  adminUpdateSettings: (settings: Settings) =>
    request<Settings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) }, { admin: true }),
  adminListPlayers: () => request<PlayerWithCount[]>("/api/admin/players", {}, { admin: true }),
  adminRenamePlayer: (id: string, name: string) =>
    request<Player>(`/api/admin/players/${id}`, { method: "PUT", body: JSON.stringify({ name }) }, { admin: true }),
  adminDeletePlayer: (id: string) => request<void>(`/api/admin/players/${id}`, { method: "DELETE" }, { admin: true }),
  adminSetMatchResult: (matchId: string, homeScore: number, awayScore: number) =>
    request<MatchView>(
      `/api/admin/matches/${matchId}/result`,
      { method: "PUT", body: JSON.stringify({ homeScore, awayScore }) },
      { admin: true }
    ),
  adminListSyncLogs: () => request<SyncLogEntry[]>("/api/admin/sync-status", {}, { admin: true }),
  adminRunSync: () => request<SyncLogEntry>("/api/admin/sync/run", { method: "POST" }, { admin: true })
};

export { ApiError };
