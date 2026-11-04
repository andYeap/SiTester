-- v3 simpan log runner per AI run untuk audit
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS runner_log text;
