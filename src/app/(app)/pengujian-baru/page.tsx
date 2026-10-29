import { redirect } from "next/navigation";

import PengujianForm from "@/components/pengujian/PengujianForm";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function PengujianBaruPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [features, roles, cycles] = await Promise.all([
    query<{ id: number; name: string; project_name: string | null; description: string | null }>(
      `SELECT id, name, project_name, description FROM features WHERE is_active = true ORDER BY name`,
    ),
    query<{ name: string; label: string }>(
      `SELECT name, label FROM testing_roles WHERE is_active = true ORDER BY label`,
    ),
    query<{ name: string }>(
      `SELECT name FROM test_cycles WHERE is_active = true ORDER BY name`,
    ),
  ]);

  return (
    <PengujianForm
      initialFeatures={features}
      initialRoles={roles.length > 0 ? roles : [{ name: "tester", label: "Tester" }]}
      initialCycles={cycles}
    />
  );
}
