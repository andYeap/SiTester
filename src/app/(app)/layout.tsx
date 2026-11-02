import { redirect } from "next/navigation";

import Shell from "@/components/shell/Shell";
import { getSessionUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Shell user={user} unread={user.unread}>
      {children}
    </Shell>
  );
}
