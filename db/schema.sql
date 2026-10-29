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

CREATE TABLE IF NOT EXISTS test_cycles (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

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
