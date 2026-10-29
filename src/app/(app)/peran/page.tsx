import { redirect } from "next/navigation";

import RoleManager from "@/components/master/RoleManager";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function PeranPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const roles = await query<{ name: string; label: string; is_active: boolean }>(
    `SELECT name, label, is_active FROM testing_roles ORDER BY name`,
  );

  return <RoleManager initialRoles={roles} />;
}
