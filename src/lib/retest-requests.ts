import { query } from "@/lib/db";

export type PendingRetestRequest = {
  id: number;
  reason: string | null;
  created_at: string;
  tested_as_role: string;
  test_cycle: string | null;
  feature_name: string;
  user_name: string;
};

/** Permohonan yang benar-benar menunggu: status pending dan belum kedaluwarsa. */
export async function getPendingRetestRequests(): Promise<PendingRetestRequest[]> {
  return query<PendingRetestRequest>(
    `SELECT r.id, r.reason, r.created_at, r.tested_as_role, r.test_cycle,
            f.name AS feature_name, u.name AS user_name
       FROM retest_requests r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.user_id
      WHERE r.status='pending' AND r.expires_at > now() ORDER BY r.created_at DESC`,
  );
}
