import { redirect } from "next/navigation";

import RiwayatTable from "@/components/history/RiwayatTable";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSessions } from "@/lib/history";

export default async function RiwayatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const isKetua = user.role === "ketua_tim";

  const [initialSessions, features, cycles] = await Promise.all([
    getSessions(user.id, isKetua, {}),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM features WHERE is_active = true ORDER BY name`,
    ),
    query<{ name: string }>(
      `SELECT name FROM test_cycles ORDER BY name`,
    ),
  ]);

  return (
    <RiwayatTable
      isKetua={isKetua}
      initialSessions={initialSessions}
      features={features}
      cycles={cycles.map((c) => c.name)}
    />
  );
}
