-- v3 performance: index untuk query riwayat/dashboard
CREATE INDEX IF NOT EXISTS test_sessions_user_date_idx
  ON test_sessions (user_id, tested_at DESC);

CREATE INDEX IF NOT EXISTS test_sessions_date_idx
  ON test_sessions (tested_at DESC);

CREATE INDEX IF NOT EXISTS features_active_name_idx
  ON features (is_active, name);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;
