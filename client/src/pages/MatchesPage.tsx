import { useEffect, useState } from "react";
import { MatchCard } from "../components/MatchCard";
import { api } from "../api";
import type { MatchView, Round } from "../types";
import { ROUND_LABELS, ROUND_ORDER } from "../types";

export function MatchesPage() {
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    api
      .listMatches()
      .then(setMatches)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar partidos"))
      .finally(() => setLoading(false));
  }

  function handleSaved(updated: MatchView) {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  if (loading) return <p className="muted">Cargando partidos...</p>;
  if (error) return <div className="error-banner">{error}</div>;

  const byRound = new Map<Round, MatchView[]>();
  for (const round of ROUND_ORDER) byRound.set(round, []);
  for (const match of matches) {
    byRound.get(match.round)?.push(match);
  }

  // Partidos que todavía no empiezan y que aún no pronosticaste: nudge para no
  // quedar afuera por olvido.
  const pendingCount = matches.filter((m) => !m.revealed && m.status !== "FINISHED" && !m.myPrediction).length;

  return (
    <div>
      {pendingCount > 0 && (
        <div className="pending-banner">
          ⏳ Te {pendingCount === 1 ? "falta" : "faltan"} <strong>{pendingCount}</strong>{" "}
          {pendingCount === 1 ? "pronóstico" : "pronósticos"} de {pendingCount === 1 ? "un partido" : "partidos"} que
          todavía no {pendingCount === 1 ? "empieza" : "empiezan"}.
        </div>
      )}
      {ROUND_ORDER.filter((round) => (byRound.get(round)?.length ?? 0) > 0).map((round) => (
        <section key={round}>
          <h2 className="round-heading">{ROUND_LABELS[round]}</h2>
          {byRound.get(round)!.map((match) => (
            <MatchCard key={match.id} match={match} onSaved={handleSaved} />
          ))}
        </section>
      ))}
      {matches.length === 0 && <p className="muted">Todavía no hay partidos confirmados.</p>}
    </div>
  );
}
