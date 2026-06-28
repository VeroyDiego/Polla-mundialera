import { useEffect, useState } from "react";
import { NamePicker } from "./components/NamePicker";
import { MatchesPage } from "./pages/MatchesPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { AdminPage } from "./pages/AdminPage";
import { api, clearStoredPlayerId, getStoredPlayerId } from "./api";
import type { Player } from "./types";

type Tab = "matches" | "leaderboard" | "admin";

export function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<Tab>("matches");

  useEffect(() => {
    const storedId = getStoredPlayerId();
    if (!storedId) {
      setCheckingSession(false);
      return;
    }
    api
      .listPlayers()
      .then((players) => {
        const found = players.find((p) => p.id === storedId);
        if (found) {
          setPlayer(found);
        } else {
          clearStoredPlayerId();
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return null;

  if (!player) {
    return <NamePicker onSelected={setPlayer} />;
  }

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">Polla Mundial 26</h1>
        <p className="app-subtitle">Hola, {player.name}</p>
        <nav className="tab-bar">
          <button className={`tab-button ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
            Partidos
          </button>
          <button
            className={`tab-button ${tab === "leaderboard" ? "active" : ""}`}
            onClick={() => setTab("leaderboard")}
          >
            Tabla
          </button>
          <button className={`tab-button ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
            Admin
          </button>
        </nav>
      </header>
      <main className="app-main">
        {tab === "matches" && <MatchesPage />}
        {tab === "leaderboard" && <LeaderboardPage />}
        {tab === "admin" && <AdminPage />}
      </main>
    </>
  );
}
