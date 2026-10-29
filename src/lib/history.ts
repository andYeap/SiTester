import { query } from "@/lib/db";

export type SessionFilters = {
  dari?: string;
  sampai?: string;
  userId?: string;
  featureId?: string;
  result?: string;
  q?: string;
  cycle?: string;
};

export type SessionRow = {
  id: number;
  tested_at: string;
  result: string;
  severity: string | null;
  environment: string | null;
  expected: string | null;
  actual: string | null;
  notes: string | null;
  is_retest: boolean;
  tested_as_role: string;
  test_cycle: string | null;
  evidence_path: string | null;
  evidence_url: string | null;
  user_name: string;
  feature_name: string;
  approver_name: string | null;
};

export async function getSessions(
  viewerId: string,
  isKetua: boolean,
  f: SessionFilters,
): Promise<SessionRow[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (!isKetua) {
    conds.push(`s.user_id = $${i++}`);
    vals.push(viewerId);
  } else if (f.userId) {
    conds.push(`s.user_id = $${i++}`);
    vals.push(f.userId);
  }
  if (f.dari) {
    conds.push(`s.tested_at >= $${i++}`);
    vals.push(f.dari);
  }
  if (f.sampai) {
    conds.push(`s.tested_at <= $${i++}`);
    vals.push(f.sampai);
  }
  if (f.featureId) {
    conds.push(`s.feature_id = $${i++}`);
    vals.push(Number(f.featureId));
  }
  if (f.result && ["pass", "fail", "bug"].includes(f.result)) {
    conds.push(`s.result = $${i++}`);
    vals.push(f.result);
  }
  if (f.cycle) {
    conds.push(`s.test_cycle = $${i++}`);
    vals.push(f.cycle);
  }
  if (f.q) {
    conds.push(`(s.notes ILIKE $${i} OR f.name ILIKE $${i} OR u.name ILIKE $${i})`);
    vals.push(`%${f.q}%`);
    i++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  return query<SessionRow>(
    `SELECT s.id, s.tested_at::text AS tested_at, s.result, s.severity, s.environment,
            s.expected, s.actual, s.notes, s.is_retest, s.tested_as_role,
            s.test_cycle, s.evidence_path, s.evidence_url,
            u.name AS user_name, f.name AS feature_name,
            ap.name AS approver_name
       FROM test_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN features f ON f.id = s.feature_id
       LEFT JOIN retest_approvals ra ON ra.id = s.retest_approval_id
       LEFT JOIN users ap ON ap.id = ra.approved_by
      ${where}
      ORDER BY s.tested_at DESC, s.id DESC
      LIMIT 200`,
    vals,
  );
}
