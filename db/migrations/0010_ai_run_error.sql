-- Klasifikasi kegagalan provider sebagai status error (bukan fail/defect).
ALTER TABLE ai_test_runs DROP CONSTRAINT IF EXISTS ai_test_runs_status_check;
ALTER TABLE ai_test_runs ADD CONSTRAINT ai_test_runs_status_check
  CHECK (status IN ('queued','running','completed','failed','cancelled','confirmed','error'));
