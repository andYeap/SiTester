import { redirect } from "next/navigation";

import FeatureManager from "@/components/master/FeatureManager";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function FiturPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const features = await query<{
    id: number;
    name: string;
    description: string | null;
    project_name: string | null;
    is_active: boolean;
    verified: boolean;
    creator_name: string | null;
    test_count: number;
  }>(
    `SELECT f.id, f.name, f.description, f.project_name, f.is_active, f.verified,
            u.name AS creator_name,
            (SELECT count(*)::int FROM test_sessions s WHERE s.feature_id = f.id) AS test_count
       FROM features f LEFT JOIN users u ON u.id = f.created_by
      ORDER BY f.name`,
  );

  return <FeatureManager isKetua={user.role === "ketua_tim"} initialFeatures={features} />;
}
