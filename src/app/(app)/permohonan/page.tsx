import { redirect } from "next/navigation";

import PermohonanView from "@/components/permohonan/PermohonanView";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPendingRetestRequests } from "@/lib/retest-requests";

export default async function PermohonanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const pending = await getPendingRetestRequests();
  const reviewed = await query<{
    id: number;
    status: string;
    reason: string | null;
    rejection_reason: string | null;
    reviewed_at: string | null;
    tested_as_role: string;
    test_cycle: string | null;
    feature_name: string;
    user_name: string;
    reviewer_name: string | null;
  }>(
    `SELECT r.id, r.status, r.reason, r.rejection_reason, r.reviewed_at, r.tested_as_role, r.test_cycle,
            f.name AS feature_name, u.name AS user_name, rv.name AS reviewer_name
       FROM retest_requests r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN users rv ON rv.id = r.reviewed_by
      WHERE r.status <> 'pending' ORDER BY r.reviewed_at DESC LIMIT 20`,
  );

  return <PermohonanView initialPending={pending} initialReviewed={reviewed} />;
}
