import { useEffect, useState } from "react";
import { api, setStoredPlayerId } from "../api";
import type { Player } from "../types";

interface NamePickerProps {
  onSelected: (player: Player) => void;
}

export function NamePicker({ onSelected }: NamePickerProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listPlayers()
      .then(setPlayers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function selectExisting(player: Player) {
    setStoredPlayerId(player.id);
    onSelected(player);
  }

  async function createNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      const player = await api.createPlayer(newName.trim());
      setStoredPlayerId(player.id);
      onSelected(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear jugador");
    }
  }

  return (
    <div className="name-picker">
      <h1 className="app-title">Polla Mundial 26</h1>
      {error && <div className="error-banner">{error}</div>}
      {!loading && players.length > 0 && (
        <div className="name-picker-list">
          <p className="muted">Elige tu nombre:</p>
          {players.map((p) => (
            <button key={p.id} className="name-picker-button" onClick={() => selectExisting(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <form className="name-picker-form" onSubmit={createNew}>
        <input
          className="name-picker-input"
          placeholder="Nuevo participante..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
        />
        <button className="save-button" type="submit" style={{ width: "auto" }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
