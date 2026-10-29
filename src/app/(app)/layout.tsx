import { redirect } from "next/navigation";

import Shell from "@/components/shell/Shell";
import { getSessionUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [user.id],
  );

  return (
    <Shell user={user} unread={Number(row?.n ?? 0)}>
      {children}
    </Shell>
  );
}
