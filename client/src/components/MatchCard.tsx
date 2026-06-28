import { useState } from "react";
import { DigitCellInput, DigitCellStatic, DigitSeparator } from "./DigitCell";
import { formatKickoff } from "../utils/time";
import type { MatchView } from "../types";
import { ApiError, api } from "../api";

interface MatchCardProps {
  match: MatchView;
  onSaved: (match: MatchView) => void;
}

export function MatchCard({ match, onSaved }: MatchCardProps) {
  const [homeScore, setHomeScore] = useState<number | "">(match.myPrediction?.homeScore ?? "");
  const [awayScore, setAwayScore] = useState<number | "">(match.myPrediction?.awayScore ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const locked = match.revealed;
  const canSave = !locked && homeScore !== "" && awayScore !== "" && !saving;

  async function handleSave() {
    if (homeScore === "" || awayScore === "") return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.savePrediction(match.id, homeScore, awayScore);
      setSaved(true);
      onSaved({ ...match, myPrediction: { homeScore, awayScore } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el pronóstico");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="match-card">
      <div className="match-teams">
        <span className="match-team-name">{match.homeTeam}</span>
        <span>vs</span>
        <span className="match-team-name">{match.awayTeam}</span>
      </div>
      <div className="match-meta">
        <span>{formatKickoff(match.kickoffUtc)} (Stgo)</span>
        {match.status === "FINISHED" ? (
          <span className="match-status-pill match-status-pill--finished">Finalizado</span>
        ) : locked ? (
          <span className="match-status-pill match-status-pill--locked">En curso / por revelar</span>
        ) : (
          <span className="match-status-pill">
            {match.predictionsSubmittedCount}/{match.totalPlayers} pronosticaron
          </span>
        )}
      </div>

      {match.status === "FINISHED" ? (
        <div className="match-prediction-row">
          <DigitCellStatic value={match.homeScore ?? 0} correct />
          <DigitSeparator />
          <DigitCellStatic value={match.awayScore ?? 0} correct />
        </div>
      ) : (
        <div className="match-prediction-row">
          <DigitCellInput
            value={homeScore}
            onChange={setHomeScore}
            disabled={locked}
            ariaLabel={`Goles de ${match.homeTeam}`}
          />
          <DigitSeparator />
          <DigitCellInput
            value={awayScore}
            onChange={setAwayScore}
            disabled={locked}
            ariaLabel={`Goles de ${match.awayTeam}`}
          />
        </div>
      )}

      {!locked && match.status !== "FINISHED" && (
        <>
          <button className="save-button" disabled={!canSave} onClick={handleSave}>
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar pronóstico"}
          </button>
          {error && <div className="error-banner">{error}</div>}
        </>
      )}

      {locked && !match.predictions && (
        <p className="match-hint">A ciegas hasta el pitazo: los pronósticos se revelan al iniciar el partido.</p>
      )}

      {locked && match.predictions && (
        <div className="others-predictions">
          {match.predictions.map((p) => (
            <div className="others-predictions-row" key={p.playerId}>
              <span>{p.playerName}</span>
              <span>
                {p.homeScore} - {p.awayScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
