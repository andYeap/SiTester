-- v3 AI test runs: antrean runner eksternal
CREATE TABLE IF NOT EXISTS ai_test_runs (
  id                   bigserial PRIMARY KEY,
  created_by           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_url           text NOT NULL,
  goal                 text NOT NULL,
  success_criteria     text,
  feature_id           bigint NOT NULL REFERENCES features(id) ON DELETE RESTRICT,
  tested_as_role       text NOT NULL REFERENCES testing_roles(name) ON UPDATE CASCADE,
  test_cycle           text REFERENCES test_cycles(name) ON UPDATE CASCADE,
  status               text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued','running','completed','failed','cancelled','confirmed')),
  result               text CHECK (result IN ('pass','fail','bug')),
  severity             text CHECK (severity IN ('low','medium','high','critical')),
  notes                text,
  evidence_path        text,
  error                text,
  runner_id            text,
  model                text,
  claimed_at           timestamptz,
  finished_at          timestamptz,
  confirmed_session_id bigint REFERENCES test_sessions(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_test_runs_status_idx
  ON ai_test_runs (status, created_at);
CREATE INDEX IF NOT EXISTS ai_test_runs_user_idx
  ON ai_test_runs (created_by, created_at DESC);
