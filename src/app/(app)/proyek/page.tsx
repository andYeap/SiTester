import { redirect } from "next/navigation";

import ProjectManager from "@/components/master/ProjectManager";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function ProyekPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ketua_tim") redirect("/dashboard");

  const projects = await query<{
    id: number;
    name: string;
    is_active: boolean;
    test_count: number;
    feature_count: number;
  }>(
    `SELECT p.id, p.name, p.is_active,
            (SELECT count(*)::int FROM test_sessions s JOIN features f ON f.id = s.feature_id WHERE f.project_name = p.name) AS test_count,
            (SELECT count(*)::int FROM features f WHERE f.project_name = p.name) AS feature_count
       FROM projects p ORDER BY p.name`,
  );

  return <ProjectManager initialProjects={projects} />;
}
