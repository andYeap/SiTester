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
  if (body?.status !== "cancelled" && body?.status !== "rejected") {
    return err("Status tidak didukung.", 422);
  }

  const row = await queryOne<{
    created_by: string;
    status: string;
    confirmed_session_id: number | null;
  }>(
    `SELECT created_by, status, confirmed_session_id
       FROM ai_test_runs WHERE id=$1`,
    [id],
  );
  if (!row || (row.created_by !== user.id && user.role !== "ketua_tim")) {
    return err("AI run tidak ditemukan.", 404);
  }

  if (body.status === "cancelled") {
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

  // Tolak hasil: draft AI dibuang tanpa membuat riwayat. Hanya untuk run
  // yang sudah selesai dan belum dikonfirmasi.
  if (row.status !== "completed") {
    return err("Hanya hasil yang sudah selesai bisa ditolak.", 422);
  }
  if (row.confirmed_session_id !== null) {
    return err("Hasil sudah dikonfirmasi menjadi riwayat; tidak bisa ditolak.", 422);
  }

  const rejected = await queryOne<{ id: number }>(
    `UPDATE ai_test_runs
        SET status='rejected', finished_at=now(), updated_at=now()
      WHERE id=$1 AND status='completed' AND confirmed_session_id IS NULL
      RETURNING id`,
    [id],
  );
  if (!rejected) return err("Hasil sudah berubah. Muat ulang halaman.", 409);

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "ai_runs.reject",
    target: `ai_test_run#${id}`,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("AI run tidak ditemukan.", 404);
  const force = new URL(request.url).searchParams.get("force") === "1";

  const row = await queryOne<{
    created_by: string;
    status: string;
    confirmed_session_id: number | null;
  }>(
    `SELECT created_by, status, confirmed_session_id
       FROM ai_test_runs WHERE id=$1`,
    [id],
  );
  if (!row || (row.created_by !== user.id && user.role !== "ketua_tim")) {
    return err("AI run tidak ditemukan.", 404);
  }
  // Sedang dikerjakan runner; menunggu selesai lebih aman daripada
  // menghapus baris yang masih ditulis.
  if (row.status === "running") {
    return err(
      "Run sedang dijalankan runner. Tunggu selesai, lalu hapus bila perlu.",
      409,
    );
  }
  if (!force && row.confirmed_session_id !== null) {
    return err(
      "Run ini sudah dikonfirmasi menjadi riwayat. Menghapus run tidak menghapus riwayatnya. " +
        "Ulangi dengan ?force=1 bila tetap ingin menghapus run ini saja.",
      409,
    );
  }

  const removed = await queryOne<{ id: number; status: string }>(
    `DELETE FROM ai_test_runs WHERE id=$1 RETURNING id, status`,
    [id],
  );
  if (!removed) return err("AI run tidak ditemukan.", 404);

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "ai_runs.delete",
    target: `ai_test_run#${id}`,
    changes: {
      status: removed.status,
      confirmed_session_id: row.confirmed_session_id,
      force,
    },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
