-- Revisi: kategori AI, siklus per proyek, hasil 2 nilai, urgensi 3 tingkat.

ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'fungsional';
ALTER TABLE ai_test_runs DROP CONSTRAINT IF EXISTS ai_test_runs_category_check;
ALTER TABLE ai_test_runs ADD CONSTRAINT ai_test_runs_category_check
  CHECK (category IN ('fungsional','ketahanan','stress','keamanan'));

ALTER TABLE test_cycles ADD COLUMN IF NOT EXISTS project_name text;
DO $$ BEGIN
  ALTER TABLE test_cycles ADD CONSTRAINT test_cycles_project_name_fkey
    FOREIGN KEY (project_name) REFERENCES projects(name) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE test_sessions SET result='fail' WHERE result='bug';
ALTER TABLE test_sessions DROP CONSTRAINT IF EXISTS test_sessions_result_check;
ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_result_check
  CHECK (result IN ('pass','fail'));

UPDATE ai_test_runs SET result='fail' WHERE result='bug';
ALTER TABLE ai_test_runs DROP CONSTRAINT IF EXISTS ai_test_runs_result_check;
ALTER TABLE ai_test_runs ADD CONSTRAINT ai_test_runs_result_check
  CHECK (result IN ('pass','fail'));

UPDATE test_sessions SET severity='high' WHERE severity='critical';
ALTER TABLE test_sessions DROP CONSTRAINT IF EXISTS test_sessions_severity_check;
ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_severity_check
  CHECK (severity IN ('low','medium','high'));

UPDATE defects SET severity='high' WHERE severity='critical';
ALTER TABLE defects DROP CONSTRAINT IF EXISTS defects_severity_check;
ALTER TABLE defects ADD CONSTRAINT defects_severity_check
  CHECK (severity IN ('low','medium','high'));

UPDATE ai_test_runs SET severity='high' WHERE severity='critical';
ALTER TABLE ai_test_runs DROP CONSTRAINT IF EXISTS ai_test_runs_severity_check;
ALTER TABLE ai_test_runs ADD CONSTRAINT ai_test_runs_severity_check
  CHECK (severity IN ('low','medium','high'));
