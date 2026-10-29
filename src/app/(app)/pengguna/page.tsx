import { redirect } from "next/navigation";

import UserManager from "@/components/master/UserManager";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function PenggunaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const users = await query<{
    id: string;
    name: string;
    email: string;
    role: string;
    test_count: number;
  }>(
    `SELECT u.id, u.name, u.email, u.role,
            (SELECT count(*)::int FROM test_sessions s WHERE s.user_id = u.id) AS test_count
       FROM users u ORDER BY u.name`,
  );

  return <UserManager selfId={user.id} initialUsers={users} />;
}
