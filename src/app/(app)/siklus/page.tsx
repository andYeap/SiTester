import { redirect } from "next/navigation";

import CycleManager from "@/components/master/CycleManager";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function SiklusPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const cycles = await query<{
    id: number;
    name: string;
    description: string | null;
    brief: string | null;
    is_active: boolean;
    test_count: number;
    scope_count: number;
    feature_ids: number[] | null;
  }>(
    `SELECT c.id, c.name, c.description, c.brief, c.is_active,
            (SELECT count(*)::int FROM test_sessions s WHERE s.test_cycle = c.name) AS test_count,
            (SELECT count(*)::int FROM cycle_features cf WHERE cf.cycle_id = c.id) AS scope_count,
            (SELECT coalesce(array_agg(cf.feature_id), '{}') FROM cycle_features cf WHERE cf.cycle_id = c.id) AS feature_ids
       FROM test_cycles c ORDER BY c.name`,
  );

  const features = await query<{ id: number; name: string; project: string | null }>(
    `SELECT id, name, project_name AS project FROM features WHERE is_active = true ORDER BY project_name NULLS LAST, name`,
  );

  return (
    <CycleManager
      initialCycles={cycles.map((c) => ({ ...c, feature_ids: c.feature_ids ?? [] }))}
      initialFeatures={features}
    />
  );
}
