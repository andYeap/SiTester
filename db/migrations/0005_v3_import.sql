-- v3 import v2: batch, dedupe, jejak import
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

ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS import_batch_id bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_sessions_import_batch_fk') THEN
    ALTER TABLE test_sessions ADD CONSTRAINT test_sessions_import_batch_fk
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS import_row_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS test_sessions_import_row_hash_idx
  ON test_sessions (import_row_hash);
