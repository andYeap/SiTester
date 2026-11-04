import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import {
  credentialsConfigured,
  encryptCredentials,
} from "@/lib/ai-credentials";
import { dispatchAiRunner } from "@/lib/ai-runner-dispatch";
import { query, queryOne } from "@/lib/db";

const MAX_PENDING = 3;

function validTarget(raw: string): string | null {
  if (raw.length === 0 || raw.length > 2000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function text(
  value: unknown,
  max: number,
  { trim = true }: { trim?: boolean } = {},
): string | null {
  if (typeof value !== "string") return null;
  const out = trim ? value.trim() : value;
  if (out.length === 0) return null;
  return out.slice(0, max);
}

export async function GET() {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const isKetua = user.role === "ketua_tim";

  const rows = await query<{
    id: string | number;
    target_url: string;
    goal: string;
    success_criteria: string | null;
    status: string;
    result: string | null;
    severity: string | null;
    notes: string | null;
    evidence_path: string | null;
    error: string | null;
    created_at: string;
    finished_at: string | null;
    confirmed_session_id: number | null;
    feature_name: string;
    user_name: string;
  }>(
    `SELECT r.id, r.target_url, r.goal, r.success_criteria, r.status, r.result,
            r.severity, r.notes, r.evidence_path, r.error, r.created_at::text AS created_at,
            r.finished_at::text AS finished_at, r.confirmed_session_id,
            f.name AS feature_name, u.name AS user_name
       FROM ai_test_runs r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.created_by
      ${isKetua ? "" : "WHERE r.created_by = $1"}
      ORDER BY r.created_at DESC
      LIMIT 50`,
    isKetua ? [] : [user.id],
  );

  return NextResponse.json({
    runs: rows.map((row) => ({ ...row, id: Number(row.id) })),
  });
}

export async function POST(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as {
    target_url?: unknown;
    goal?: unknown;
    success_criteria?: unknown;
    feature_id?: unknown;
    tested_as_role?: unknown;
    test_cycle?: unknown;
    use_login?: unknown;
    login_url?: unknown;
    login_goal?: unknown;
    login_email?: unknown;
    login_password?: unknown;
    login_email_label?: unknown;
    login_password_label?: unknown;
    login_submit_label?: unknown;
  } | null;

  const targetUrl = validTarget(
    typeof body?.target_url === "string" ? body.target_url.trim() : "",
  );
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const criteria =
    typeof body?.success_criteria === "string" && body.success_criteria.trim() !== ""
      ? body.success_criteria.trim().slice(0, 2000)
      : null;
  const featureId = Number(body?.feature_id);
  const role = typeof body?.tested_as_role === "string" ? body.tested_as_role : "tester";
  const cycle =
    typeof body?.test_cycle === "string" && body.test_cycle.trim() !== ""
      ? body.test_cycle.trim()
      : null;

  const useLogin = body?.use_login === true;
  let loginUrl: string | null = null;
  let loginGoal: string | null = null;
  let loginEmailLabel: string | null = null;
  let loginPasswordLabel: string | null = null;
  let loginSubmitLabel: string | null = null;
  let loginCredentials: string | null = null;

  if (useLogin) {
    const loginUrlRaw = text(body?.login_url, 2000);
    if (loginUrlRaw) {
      loginUrl = validTarget(loginUrlRaw);
      if (!loginUrl) {
        return err("URL login harus http(s) yang valid.", 422);
      }
    }
    loginGoal = text(body?.login_goal, 1000);
    loginEmailLabel = text(body?.login_email_label, 200);
    loginPasswordLabel = text(body?.login_password_label, 200);
    loginSubmitLabel = text(body?.login_submit_label, 200);

    const email = text(body?.login_email, 320);
    const password = text(body?.login_password, 500, { trim: false });
    if (email || password) {
      if (!email || !password) {
        return err("Email dan password target harus diisi keduanya.", 422);
      }
      if (!credentialsConfigured()) {
        return err(
          "Penyimpanan kredensial belum dikonfigurasi. Hubungi administrator.",
          422,
        );
      }
      loginCredentials = encryptCredentials({ email, password });
      if (!loginCredentials) {
        return err("Gagal menyimpan kredensial target.", 422);
      }
    }
  }

  if (!targetUrl) {
    return err("URL target harus http(s) yang valid (maks 2000).", 422);
  }
  if (goal.length < 5 || goal.length > 2000) {
    return err("Tujuan pengujian wajib 5–2000 karakter.", 422);
  }
  if (!Number.isInteger(featureId) || featureId <= 0) {
    return err("Fitur tidak valid.", 422);
  }

  const [feature, roleOk, cycleOk] = await Promise.all([
    queryOne<{ id: number }>(
      `SELECT id FROM features WHERE id=$1 AND is_active=true`,
      [featureId],
    ),
    queryOne<{ name: string }>(
      `SELECT name FROM testing_roles WHERE name=$1 AND is_active=true`,
      [role],
    ),
    cycle
      ? queryOne<{ name: string }>(
          `SELECT name FROM test_cycles WHERE name=$1 AND is_active=true`,
          [cycle],
        )
      : Promise.resolve({ name: "" }),
  ]);

  if (!feature) return err("Fitur tidak aktif/tidak ditemukan.", 422);
  if (!roleOk) return err("Peran pengujian tidak valid.", 422);
  if (cycle && !cycleOk) return err("Siklus tidak valid/nonaktif.", 422);

  if (cycle) {
    const [scopeCount, inScope] = await Promise.all([
      queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM cycle_features cf
          JOIN test_cycles c ON c.id=cf.cycle_id WHERE c.name=$1`,
        [cycle],
      ),
      queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM cycle_features cf
          JOIN test_cycles c ON c.id=cf.cycle_id
         WHERE c.name=$1 AND cf.feature_id=$2`,
        [cycle, featureId],
      ),
    ]);
    if (Number(scopeCount?.n ?? 0) > 0 && Number(inScope?.n ?? 0) === 0) {
      return err(`Fitur ini tidak termasuk lingkup siklus "${cycle}".`, 422);
    }
  }

  const pending = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM ai_test_runs
      WHERE created_by=$1 AND status IN ('queued','running')`,
    [user.id],
  );
  if (Number(pending?.n ?? 0) >= MAX_PENDING) {
    return err(
      `Maksimal ${MAX_PENDING} AI test aktif per pengguna. Tunggu runner menyelesaikan yang lain.`,
      422,
    );
  }

  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO ai_test_runs
      (created_by, target_url, goal, success_criteria, feature_id, tested_as_role,
       test_cycle, status, use_login, login_url, login_goal, login_email_label,
       login_password_label, login_submit_label, login_credentials_enc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      user.id,
      targetUrl,
      goal,
      criteria,
      featureId,
      role,
      cycle,
      useLogin,
      loginUrl,
      loginGoal,
      loginEmailLabel,
      loginPasswordLabel,
      loginSubmitLabel,
      loginCredentials,
    ],
  );

  const runId = Number(inserted?.id);
  await dispatchAiRunner(runId);

  return NextResponse.json({ ok: true, id: runId }, { status: 201 });
}
