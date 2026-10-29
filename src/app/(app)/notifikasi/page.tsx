import { redirect } from "next/navigation";

import NotifikasiView from "@/components/notifikasi/NotifikasiView";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function NotifikasiPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const items = await query<{
    id: number;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, type, title, body, link, read_at, created_at FROM notifications
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [user.id],
  );

  return <NotifikasiView initialItems={items} />;
}
