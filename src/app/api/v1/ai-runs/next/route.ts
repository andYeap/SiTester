import { NextResponse } from "next/server";

import { decryptCredentials } from "@/lib/ai-credentials";
import { isRunnerAuthorized, runnerId, runnerUnauthorized } from "@/lib/runner-auth";
import { query } from "@/lib/db";

/** Runner mengambil satu antrean dan mengklaimnya secara atomik. */
export async function GET(request: Request) {
  if (!isRunnerAuthorized(request)) return runnerUnauthorized();

  // Kembalikan run yang tertahan (runner mati) ke antrean.
  await query(
    `UPDATE ai_test_runs
        SET status='queued', runner_id=NULL, claimed_at=NULL, updated_at=now()
      WHERE status='running' AND claimed_at < now() - interval '15 minutes'`,
  );

  const claimed = await query<{
    id: string;
    target_url: string;
    goal: string;
    success_criteria: string | null;
    feature_id: number;
    tested_as_role: string;
    test_cycle: string | null;
    feature_name: string;
    user_name: string;
    use_login: boolean;
    login_url: string | null;
    login_goal: string | null;
    login_email_label: string | null;
    login_password_label: string | null;
    login_submit_label: string | null;
    login_credentials_enc: string | null;
  }>(
    `WITH next AS (
       SELECT id FROM ai_test_runs
        WHERE status='queued'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE ai_test_runs r
        SET status='running', runner_id=$1, claimed_at=now(), updated_at=now()
       FROM next
      WHERE r.id = next.id
      RETURNING r.id, r.target_url, r.goal, r.success_criteria, r.feature_id,
                r.tested_as_role, r.test_cycle, r.use_login, r.login_url,
                r.login_goal, r.login_email_label, r.login_password_label,
                r.login_submit_label, r.login_credentials_enc,
                (SELECT name FROM features WHERE id=r.feature_id) AS feature_name,
                (SELECT name FROM users WHERE id=r.created_by) AS user_name`,
    [runnerId(request)],
  );

  if (claimed.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const run = claimed[0];
  const { login_credentials_enc, ...safeRun } = run;
  const loginCredentials = decryptCredentials(login_credentials_enc);
  return NextResponse.json({
    run: {
      ...safeRun,
      id: Number(run.id),
      feature_id: Number(run.feature_id),
      login_email: loginCredentials?.email ?? null,
      login_password: loginCredentials?.password ?? null,
    },
  });
}
