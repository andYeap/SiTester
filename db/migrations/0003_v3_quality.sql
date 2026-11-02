-- v3: test case, defect, catatan approval, integritas proyek

-- Proyek sebagai FK nyata (nama tetap dipakai untuk kompatibilitas tampilan).
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

-- Backfill defect untuk temuan Fail/Bug lama yang belum punya defect.
INSERT INTO defects (feature_id, session_id, title, severity, status, created_by, created_at)
SELECT s.feature_id, s.id, 'Temuan: ' || f.name, coalesce(s.severity, 'medium'), 'open',
       s.user_id, s.created_at
  FROM test_sessions s
  JOIN features f ON f.id = s.feature_id
 WHERE s.result IN ('fail','bug')
   AND NOT EXISTS (SELECT 1 FROM defects d WHERE d.session_id = s.id);
