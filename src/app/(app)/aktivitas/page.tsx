import { redirect } from "next/navigation";

import AktivitasView from "@/components/audit/AktivitasView";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function AktivitasPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const logs = await query<{
    id: number;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    target: string | null;
    changes: Record<string, unknown> | null;
    ip: string | null;
    created_at: string;
  }>(
    `SELECT id, actor_name, actor_role, action, target, changes, ip, created_at
       FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 100`,
  );

  return <AktivitasView user={user} initialLogs={logs} />;
}
