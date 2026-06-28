import { useEffect, useState } from "react";
import { api } from "../api";
import type { LeaderboardEntry } from "../types";

export function LeaderboardPage() {
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

  return (
    <div>
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
          {entries.map((entry, idx) => (
            <tr key={entry.playerId} className={idx === 0 ? "leaderboard-rank-1" : ""}>
              <td>{idx + 1}</td>
              <td>{entry.playerName}</td>
              <td>{entry.totalPoints}</td>
              <td>{entry.exactCount}</td>
              <td>{entry.played}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && <p className="muted">Todavía no hay partidos finalizados.</p>}
    </div>
  );
}
