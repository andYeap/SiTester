import { redirect } from "next/navigation";

import DashboardView from "@/components/dashboard/DashboardView";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDashboardStats } from "@/lib/stats";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [cycles, initialStats] = await Promise.all([
    query<{ name: string }>(
      `SELECT name FROM test_cycles WHERE is_active = true ORDER BY name`,
    ),
    getDashboardStats(user.id, user.role === "ketua_tim", 30, null),
  ]);

  return (
    <DashboardView
      isKetua={user.role === "ketua_tim"}
      initialCycles={cycles.map((c) => c.name)}
      initialStats={initialStats}
    />
  );
}
