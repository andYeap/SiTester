import { redirect } from "next/navigation";

import ImportView from "@/components/import/ImportView";
import { getSessionUser } from "@/lib/auth";

export default async function ImportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  return <ImportView />;
}
