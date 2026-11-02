import { redirect } from "next/navigation";

import PengujianForm from "@/components/pengujian/PengujianForm";
import { getSessionUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

export default async function PengujianBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string; cycle?: string; ai_run?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  const [features, roles, cycles, projects] = await Promise.all([
    query<{ id: number; name: string; project_name: string | null; description: string | null }>(
      `SELECT id, name, project_name, description FROM features WHERE is_active = true ORDER BY name`,
    ),
    query<{ name: string; label: string }>(
      `SELECT name, label FROM testing_roles WHERE is_active = true ORDER BY label`,
    ),
    query<{ name: string }>(
      `SELECT name FROM test_cycles WHERE is_active = true ORDER BY name`,
    ),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM projects WHERE is_active = true ORDER BY name`,
    ),
  ]);

  const aiRunId = sp.ai_run ? parsePositiveInt(sp.ai_run) : null;
  const aiRun = aiRunId
    ? await queryOne<{
        id: number;
        target_url: string;
        goal: string;
        success_criteria: string | null;
        feature_id: number;
        tested_as_role: string;
        test_cycle: string | null;
        result: string;
        severity: string | null;
        notes: string | null;
        evidence_path: string | null;
      }>(
        `SELECT id, target_url, goal, success_criteria, feature_id, tested_as_role,
                test_cycle, result, severity, notes, evidence_path
           FROM ai_test_runs
          WHERE id=$1 AND status='completed' AND confirmed_session_id IS NULL
            AND (created_by=$2 OR $3 = true)`,
        [aiRunId, user.id, user.role === "ketua_tim"],
      )
    : null;

  return (
    <PengujianForm
      initialFeatures={features}
      initialRoles={roles.length > 0 ? roles : [{ name: "tester", label: "Tester" }]}
      initialCycles={cycles}
      initialProjects={projects}
      initialFeatureId={sp.feature}
      initialCycle={sp.cycle}
      initialAiRun={
        aiRun
          ? {
              id: Number(aiRun.id),
              targetUrl: aiRun.target_url,
              goal: aiRun.goal,
              successCriteria: aiRun.success_criteria,
              featureId: Number(aiRun.feature_id),
              testedAsRole: aiRun.tested_as_role,
              testCycle: aiRun.test_cycle,
              result: aiRun.result,
              severity: aiRun.severity,
              notes: aiRun.notes,
              evidencePath: aiRun.evidence_path,
            }
          : undefined
      }
    />
  );
}
