import { useEffect, useState } from "react";
import { api } from "../api";
import type { Settings } from "../types";

// Reglas de la polla. El puntaje se lee del backend para reflejar siempre lo que
// el organizador tenga configurado (no se hardcodea).
export function RulesContent() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setSettings({ exactScorePoints: 3, resultOnlyPoints: 1 }));
  }, []);

  const exact = settings?.exactScorePoints ?? 3;
  const resultOnly = settings?.resultOnlyPoints ?? 1;

  return (
    <div className="rules">
      <h2 className="round-heading">Cómo se juega</h2>
      <p className="rules-lead">
        Pronosticá el <strong>marcador</strong> de cada partido de la fase eliminatoria del Mundial 2026. Cuanto más
        cerca le pegues, más puntos sumás.
      </p>

      <h3 className="rules-subtitle">Puntaje</h3>
      <div className="rules-points">
        <div className="rules-point-card rules-point-card--exact">
          <span className="rules-point-value">{exact}</span>
          <span className="rules-point-label">Marcador exacto</span>
          <span className="rules-point-desc">Acertás los goles de los dos equipos</span>
        </div>
        <div className="rules-point-card">
          <span className="rules-point-value">{resultOnly}</span>
          <span className="rules-point-label">Resultado correcto</span>
          <span className="rules-point-desc">Acertás quién gana (o el empate), pero no el marcador exacto</span>
        </div>
        <div className="rules-point-card rules-point-card--zero">
          <span className="rules-point-value">0</span>
          <span className="rules-point-label">No acertás</span>
          <span className="rules-point-desc">El resultado fue otro</span>
        </div>
      </div>

      <h3 className="rules-subtitle">Reglas clave</h3>
      <ul className="rules-list">
        <li>
          🙈 <strong>A ciegas hasta el pitazo:</strong> nadie ve los pronósticos de los demás hasta que el partido
          arranca. Antes sólo se ve cuánta gente ya pronosticó.
        </li>
        <li>
          ✏️ <strong>Editable hasta el inicio:</strong> podés cambiar tu pronóstico todas las veces que quieras, pero se
          bloquea exactamente a la hora de inicio del partido.
        </li>
        <li>
          🏆 <strong>Tabla:</strong> se ordena por puntos totales. Si hay empate, gana quien tenga más marcadores
          exactos.
        </li>
        <li>
          🕒 <strong>Horarios</strong> mostrados en hora de Chile (Santiago).
        </li>
      </ul>
    </div>
  );
}
