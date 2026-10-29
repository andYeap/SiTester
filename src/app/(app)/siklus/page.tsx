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
    is_active: boolean;
    test_count: number;
  }>(
    `SELECT c.id, c.name, c.description, c.is_active,
            (SELECT count(*)::int FROM test_sessions s WHERE s.test_cycle = c.name) AS test_count
       FROM test_cycles c ORDER BY c.name`,
  );

  return <CycleManager initialCycles={cycles} />;
}
