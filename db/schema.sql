-- TestLab Web — Postgres schema (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('tester','ketua_tim')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_agent  text,
  ip          text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS testing_roles (
  name       text PRIMARY KEY,
  label      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cycles (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text,
  brief       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE test_cycles ADD COLUMN IF NOT EXISTS brief text;

CREATE TABLE IF NOT EXISTS features (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  description text,
  project_name text,
  is_active   boolean NOT NULL DEFAULT true,
  verified    boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cycle_features (
  cycle_id   bigint NOT NULL REFERENCES test_cycles(id) ON DELETE CASCADE,
  feature_id bigint NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  PRIMARY KEY (cycle_id, feature_id)
);


CREATE TABLE IF NOT EXISTS test_sessions (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  feature_id        bigint NOT NULL REFERENCES features(id) ON DELETE RESTRICT,
  tested_at         date NOT NULL,
  result            text NOT NULL CHECK (result IN ('pass','fail','bug')),
  severity          text CHECK (severity IN ('low','medium','high','critical')),
  environment       text,
  expected          text,
  actual            text,
  notes             text,
  is_retest         boolean NOT NULL DEFAULT false,
  tested_as_role    text NOT NULL DEFAULT 'tester' REFERENCES testing_roles(name) ON UPDATE CASCADE,
  test_cycle        text REFERENCES test_cycles(name) ON UPDATE CASCADE,
  retest_approval_id bigint,
  evidence_path     text,
  evidence_url      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS test_sessions_feature_role_date_idx ON test_sessions (feature_id, tested_as_role, tested_at);
CREATE INDEX IF NOT EXISTS test_sessions_cycle_date_idx ON test_sessions (test_cycle, tested_at);
CREATE INDEX IF NOT EXISTS test_sessions_severity_idx ON test_sessions (severity);

CREATE TABLE IF NOT EXISTS retest_requests (
  id               bigserial PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id       bigint NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  tested_as_role   text NOT NULL DEFAULT 'tester' REFERENCES testing_roles(name) ON UPDATE CASCADE,
  reason           text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retest_requests_feature_role_status_idx ON retest_requests (feature_id, tested_as_role, status);

CREATE TABLE IF NOT EXISTS retest_approvals (
  id           bigserial PRIMARY KEY,
  feature_id   bigint NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_role   text REFERENCES testing_roles(name) ON UPDATE CASCADE,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_sessions_approval_fk') THEN
    ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_approval_fk
      FOREIGN KEY (retest_approval_id) REFERENCES retest_approvals(id) ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id             bigserial PRIMARY KEY,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name     text,
  actor_role     text,
  action         text NOT NULL,
  target         text,
  changes        jsonb,
  ip             text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           bigserial PRIMARY KEY,
  email        text NOT NULL,
  ip           text,
  success      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_email_created_idx ON login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_created_idx ON login_attempts (ip, created_at DESC);

-- Seed (idempotent)
INSERT INTO testing_roles (name, label, is_active) VALUES
  ('super_admin','Super Admin',true),
  ('admin_instansi','Admin Instansi',true),
  ('tester','Tester',true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO test_cycles (name, description, is_active) VALUES
  ('Lensa-ASN R1','Putaran pengujian pertama',true),
  ('Lensa-ASN R2','Putaran pengujian kedua',true)
ON CONFLICT (name) DO NOTHING;

-- Seed master Proyek dari project_name fitur yang sudah ada (sekali jalan, idempotent).
INSERT INTO projects (name, is_active)
SELECT DISTINCT f.project_name, true FROM features f
WHERE f.project_name IS NOT NULL AND btrim(f.project_name) <> ''
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.name = f.project_name)
ON CONFLICT (name) DO NOTHING;

-- Approval kedaluwarsa: single-use + TTL 7 hari.
ALTER TABLE retest_approvals
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE retest_approvals
   SET expires_at = created_at + make_interval(days => 7)
 WHERE expires_at IS NULL;

-- Permohonan pengujian ulang kedaluwarsa 7 hari agar tidak menggantung selamanya.
ALTER TABLE retest_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + make_interval(days => 7));

UPDATE retest_requests
  SET expires_at = created_at + make_interval(days => 7)
  WHERE expires_at IS NULL;

-- ===== v3 =====
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'features_project_name_fk') THEN
    ALTER TABLE features ADD CONSTRAINT features_project_name_fk
      FOREIGN KEY (project_name) REFERENCES projects(name)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS test_cases (
  id          bigserial PRIMARY KEY,
  feature_id  bigint NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  title       text NOT NULL,
  steps       text,
  expected    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS test_cases_feature_idx ON test_cases (feature_id, is_active);

ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS test_case_id bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_sessions_test_case_fk') THEN
    ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_test_case_fk
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS defects (
  id            bigserial PRIMARY KEY,
  feature_id    bigint NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  session_id    bigint REFERENCES test_sessions(id) ON DELETE SET NULL,
  title         text NOT NULL,
  severity      text CHECK (severity IN ('low','medium','high','critical')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','fixed','verified','closed','reopened')),
  assignee      text,
  fix_reference text,
  note          text,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS defects_feature_idx ON defects (feature_id, status);
CREATE INDEX IF NOT EXISTS defects_status_idx ON defects (status, created_at DESC);

ALTER TABLE retest_approvals ADD COLUMN IF NOT EXISTS note text;

INSERT INTO defects (feature_id, session_id, title, severity, status, created_by, created_at)
SELECT s.feature_id, s.id, 'Temuan: ' || f.name, coalesce(s.severity, 'medium'), 'open',
       s.user_id, s.created_at
  FROM test_sessions s
  JOIN features f ON f.id = s.feature_id
 WHERE s.result IN ('fail','bug')
   AND NOT EXISTS (SELECT 1 FROM defects d WHERE d.session_id = s.id);

CREATE INDEX IF NOT EXISTS test_sessions_user_date_idx
  ON test_sessions (user_id, tested_at DESC);
CREATE INDEX IF NOT EXISTS test_sessions_date_idx
  ON test_sessions (tested_at DESC);
CREATE INDEX IF NOT EXISTS features_active_name_idx
  ON features (is_active, name);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;

-- ===== v3 import v2 =====
CREATE TABLE IF NOT EXISTS import_batches (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  file_name    text NOT NULL,
  file_size    integer NOT NULL DEFAULT 0,
  file_hash    text NOT NULL,
  kind         text NOT NULL DEFAULT 'sessions',
  total        integer NOT NULL DEFAULT 0,
  valid        integer NOT NULL DEFAULT 0,
  invalid      integer NOT NULL DEFAULT 0,
  imported     integer NOT NULL DEFAULT 0,
  skipped      integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'committed',
  mapping      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);
CREATE INDEX IF NOT EXISTS import_batches_created_idx
  ON import_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS import_batches_user_idx
  ON import_batches (user_id, created_at DESC);

ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS import_batch_id bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_sessions_import_batch_fk') THEN
    ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_import_batch_fk
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS import_row_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS test_sessions_import_row_hash_idx
  ON test_sessions (import_row_hash);

-- ===== v3 AI test runs =====
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

ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS use_login boolean NOT NULL DEFAULT false;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_url text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_goal text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_email_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_password_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_submit_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_credentials_enc text;

