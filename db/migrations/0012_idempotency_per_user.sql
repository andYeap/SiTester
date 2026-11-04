-- Idempotency key unik per user, bukan global.
DROP INDEX IF EXISTS test_sessions_idempotency_key_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS test_sessions_idempotency_key_user_uniq
  ON test_sessions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
