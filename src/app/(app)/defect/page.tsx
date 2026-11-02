import { redirect } from "next/navigation";

import DefectView from "@/components/defects/DefectView";
import { getSessionUser } from "@/lib/auth";

export default async function DefectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <DefectView isKetua={user.role === "ketua_tim"} />;
}
