-- Esquema de Polla Mundial 26. Idempotente: se puede correr múltiples veces sin romper nada.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  round TEXT NOT NULL CHECK (round IN ('ROUND_32', 'ROUND_16', 'QUARTERFINAL', 'SEMIFINAL', 'THIRD_PLACE', 'FINAL')),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'FINISHED')),
  manually_fixed BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'SEED' CHECK (source IN ('SEED', 'SYNC', 'MANUAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches (round);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches (kickoff);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, match_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  exact_score_points INT NOT NULL DEFAULT 3,
  result_only_points INT NOT NULL DEFAULT 1,
  CHECK (id = 1)
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL,
  new_matches INT NOT NULL DEFAULT 0,
  updated_matches INT NOT NULL DEFAULT 0,
  warnings TEXT,
  error_message TEXT
);
