import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const id = parsePositiveInt((await params).id);
  if (id === null) return err("AI run tidak ditemukan.", 404);

  const row = await queryOne<{
    id: string | number;
    created_by: string;
    target_url: string;
    goal: string;
    success_criteria: string | null;
    status: string;
    result: string | null;
    severity: string | null;
    notes: string | null;
    error: string | null;
    evidence_path: string | null;
    evidence_gallery: { path: string; label: string }[] | null;
    runner_log: string | null;
    created_at: string;
    finished_at: string | null;
    confirmed_session_id: number | null;
    feature_name: string;
    user_name: string;
  }>(
    `SELECT r.id, r.created_by, r.target_url, r.goal, r.success_criteria,
            r.status, r.result, r.severity, r.notes, r.error, r.evidence_path,
            r.evidence_gallery, r.runner_log, r.created_at::text AS created_at,
            r.finished_at::text AS finished_at, r.confirmed_session_id,
            f.name AS feature_name, u.name AS user_name
       FROM ai_test_runs r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.created_by
      WHERE r.id=$1`,
    [id],
  );

  if (!row) return err("AI run tidak ditemukan.", 404);
  const { created_by: owner, ...run } = row;
  if (owner !== user.id && user.role !== "ketua_tim") {
    return err("AI run tidak ditemukan.", 404);
  }

  return NextResponse.json({
    run: { ...run, id: Number(run.id) },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("AI run tidak ditemukan.", 404);

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  if (body?.status !== "cancelled") {
    return err("Status tidak didukung.", 422);
  }

  const row = await queryOne<{ created_by: string; status: string }>(
    `SELECT created_by, status FROM ai_test_runs WHERE id=$1`,
    [id],
  );
  if (!row || (row.created_by !== user.id && user.role !== "ketua_tim")) {
    return err("AI run tidak ditemukan.", 404);
  }
  if (row.status !== "queued") {
    return err("Hanya run yang masih antre bisa dibatalkan.", 422);
  }

  const updated = await queryOne<{ id: number }>(
    `UPDATE ai_test_runs
        SET status='cancelled', finished_at=now(), updated_at=now()
      WHERE id=$1 AND status='queued'
      RETURNING id`,
    [id],
  );
  if (!updated) return err("AI run sudah diambil runner.", 409);

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "ai_runs.cancel",
    target: `ai_test_run#${id}`,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
