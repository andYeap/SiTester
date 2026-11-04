-- Idempotency form pengujian: double-submit/retry dengan Idempotency-Key sama
-- hanya membuat satu sesi. NULL = tanpa kunci (jalur lama); nilai unik.
ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS idempotency_key text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'test_sessions_idempotency_key_uniq') THEN
    CREATE UNIQUE INDEX test_sessions_idempotency_key_uniq ON test_sessions (idempotency_key) WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;
