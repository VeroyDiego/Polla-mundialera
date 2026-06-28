import { useEffect, useState } from "react";
import { api } from "../api";
import type { LeaderboardEntry } from "../types";

interface LeaderboardPageProps {
  playerId: string;
}

export function LeaderboardPage({ playerId }: LeaderboardPageProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLeaderboard()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar la tabla"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Cargando tabla de posiciones...</p>;
  if (error) return <div className="error-banner">{error}</div>;

  const myIndex = entries.findIndex((e) => e.playerId === playerId);
  const me = myIndex >= 0 ? entries[myIndex] : null;

  return (
    <div>
      {me && (
        <div className="my-summary">
          <span className="my-summary-rank">{myIndex + 1}°</span>
          <div className="my-summary-stats">
            <span className="my-summary-name">{me.playerName} (vos)</span>
            <span className="my-summary-line">
              <strong>{me.totalPoints}</strong> pts · {me.exactCount} exactos · {me.played} jugados
            </span>
          </div>
        </div>
      )}

      <h2 className="round-heading">Tabla de Posiciones</h2>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Pts</th>
            <th>Exactos</th>
            <th>Jugados</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const classes = [idx === 0 ? "leaderboard-rank-1" : "", entry.playerId === playerId ? "leaderboard-me" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={entry.playerId} className={classes}>
                <td>{idx + 1}</td>
                <td>{entry.playerName}</td>
                <td>{entry.totalPoints}</td>
                <td>{entry.exactCount}</td>
                <td>{entry.played}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entries.length === 0 && <p className="muted">Todavía no hay partidos finalizados.</p>}
    </div>
  );
}
