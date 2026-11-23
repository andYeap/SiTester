import { redirect } from "next/navigation";

import AiRunsView from "@/components/ai-runs/AiRunsView";
import { getSessionUser } from "@/lib/auth";

export default async function AiHasilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <AiRunsView mode="results" />;
}
