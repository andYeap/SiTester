-- v3 AI run per-target login (kredensial terenkripsi)
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS use_login boolean NOT NULL DEFAULT false;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_url text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_goal text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_email_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_password_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_submit_label text;
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS login_credentials_enc text;
