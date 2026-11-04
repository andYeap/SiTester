-- Retest scope mencakup siklus: approval/request per fitur+peran+siklus.
ALTER TABLE retest_requests
  ADD COLUMN IF NOT EXISTS test_cycle text REFERENCES test_cycles(name) ON UPDATE CASCADE;
ALTER TABLE retest_approvals
  ADD COLUMN IF NOT EXISTS test_cycle text REFERENCES test_cycles(name) ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS retest_requests_feature_role_status_cycle_idx
  ON retest_requests (feature_id, tested_as_role, status, test_cycle);
CREATE INDEX IF NOT EXISTS retest_approvals_feature_user_role_cycle_idx
  ON retest_approvals (feature_id, requested_by, scope_role, test_cycle);
