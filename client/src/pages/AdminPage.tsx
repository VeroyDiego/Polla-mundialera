import { useEffect, useState } from "react";
import { api, clearStoredAdminPassword, getStoredAdminPassword, setStoredAdminPassword } from "../api";
import type { MatchView, PlayerWithCount, Settings, SyncLogEntry } from "../types";
import { formatKickoff } from "../utils/time";

export function AdminPage() {
  const [unlocked, setUnlocked] = useState(() => getStoredAdminPassword() !== null);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    setStoredAdminPassword(passwordInput);
    try {
      await api.adminGetSettings();
      setUnlocked(true);
      setError(null);
    } catch {
      clearStoredAdminPassword();
      setError("Contraseña incorrecta");
    }
  }

  if (!unlocked) {
    return (
      <div className="name-picker">
        <h2>Panel de administración</h2>
        {error && <div className="error-banner">{error}</div>}
        <form className="name-picker-form" onSubmit={tryUnlock}>
          <input
            className="name-picker-input"
            type="password"
            placeholder="Contraseña admin"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button className="save-button" type="submit" style={{ width: "auto" }}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <SettingsSection />
      <PlayersSection />
      <ManualResultSection />
      <SyncSection />
    </div>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.adminGetSettings().then(setSettings);
  }, []);

  async function save(current: Settings) {
    setSaving(true);
    try {
      const updated = await api.adminUpdateSettings(current);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="admin-section">
      <h2>Puntaje</h2>
      <div className="admin-row">
        <span>Marcador exacto</span>
        <input
          className="admin-input"
          type="number"
          min={0}
          max={100}
          value={settings.exactScorePoints}
          onChange={(e) => setSettings({ ...settings, exactScorePoints: Number(e.target.value) })}
        />
      </div>
      <div className="admin-row">
        <span>Resultado correcto</span>
        <input
          className="admin-input"
          type="number"
          min={0}
          max={100}
          value={settings.resultOnlyPoints}
          onChange={(e) => setSettings({ ...settings, resultOnlyPoints: Number(e.target.value) })}
        />
      </div>
      <button className="admin-button" onClick={() => save(settings)} disabled={saving}>
        {saving ? "Guardando..." : "Guardar puntaje"}
      </button>
    </div>
  );
}

function PlayersSection() {
  const [players, setPlayers] = useState<PlayerWithCount[]>([]);

  function load() {
    api.adminListPlayers().then(setPlayers);
  }

  useEffect(load, []);

  async function rename(id: string, currentName: string) {
    const name = window.prompt("Nuevo nombre:", currentName);
    if (!name || !name.trim()) return;
    await api.adminRenamePlayer(id, name.trim());
    load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a ${name}? Esto borrará sus pronósticos.`)) return;
    await api.adminDeletePlayer(id);
    load();
  }

  return (
    <div className="admin-section">
      <h2>Participantes</h2>
      {players.map((p) => (
        <div className="admin-row admin-row--player" key={p.id}>
          <span>
            {p.name} <span className="muted">({p.predictionCount} pronósticos)</span>
          </span>
          <span>
            <button className="admin-button" onClick={() => rename(p.id, p.name)}>
              Renombrar
            </button>{" "}
            <button className="admin-button admin-button--danger" onClick={() => remove(p.id, p.name)}>
              Eliminar
            </button>
          </span>
        </div>
      ))}
      {players.length === 0 && <p className="muted">No hay participantes todavía.</p>}
    </div>
  );
}

function ManualResultSection() {
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.listMatches().then(setMatches);
  }, []);

  async function applyResult() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.adminSetMatchResult(selectedId, homeScore, awayScore);
      setMessage("Resultado actualizado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al actualizar resultado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-section">
      <h2>Corregir resultado manualmente</h2>
      <select
        className="admin-input"
        style={{ width: "100%" }}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="">-- Elegir partido --</option>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.homeTeam} vs {m.awayTeam} — {formatKickoff(m.kickoffUtc)}
            {m.manuallyFixed ? " (corregido)" : ""}
          </option>
        ))}
      </select>
      {selectedId && (
        <div className="admin-row">
          <input
            className="admin-input"
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(Number(e.target.value))}
          />
          <span>-</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            max={99}
            value={awayScore}
            onChange={(e) => setAwayScore(Number(e.target.value))}
          />
          <button className="admin-button" onClick={applyResult} disabled={saving}>
            {saving ? "Guardando..." : "Aplicar"}
          </button>
        </div>
      )}
      {message && <p className="muted">{message}</p>}
    </div>
  );
}

function SyncSection() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [running, setRunning] = useState(false);

  function load() {
    api.adminListSyncLogs().then(setLogs);
  }

  useEffect(load, []);

  async function runNow() {
    setRunning(true);
    try {
      await api.adminRunSync();
      load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-section">
      <h2>Sincronización de partidos</h2>
      <button className="admin-button" onClick={runNow} disabled={running}>
        {running ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      {logs.map((log) => (
        <div className="admin-row admin-row--player" key={log.id}>
          <span>
            {new Date(log.ranAt).toLocaleString("es-CL")} —{" "}
            {log.success ? `OK (${log.newMatches} nuevos, ${log.updatedMatches} actualizados)` : "Falló"}
          </span>
          {log.errorMessage && (
            <span style={{ color: "#e35d5d", fontSize: "0.8rem", flex: "1 1 100%" }}>⚠ {log.errorMessage}</span>
          )}
          {log.warnings && (
            <span style={{ color: "var(--color-amber)", fontSize: "0.8rem", flex: "1 1 100%" }}>{log.warnings}</span>
          )}
        </div>
      ))}
      {logs.length === 0 && <p className="muted">Sin corridas registradas todavía.</p>}
    </div>
  );
}
