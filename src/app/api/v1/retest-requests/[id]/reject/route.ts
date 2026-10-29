import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    rejection_reason?: unknown;
  } | null;
  const reason =
    typeof body?.rejection_reason === "string" ? body.rejection_reason.trim() : "";
  if (!reason || reason.length > 1000) {
    return err("Alasan penolakan wajib diisi.", 422);
  }

  const req = await queryOne<{ id: number; user_id: string; status: string }>(
    `SELECT id, user_id, status FROM retest_requests WHERE id=$1`,
    [Number(id)],
  );
  if (!req) return err("Permohonan tidak ditemukan.", 404);
  if (req.status !== "pending") {
    return err("Permohonan ini sudah diproses.", 422);
  }

  await query(
    `UPDATE retest_requests
        SET status='rejected', reviewed_by=$1, reviewed_at=now(), rejection_reason=$2
      WHERE id=$3`,
    [ketua.id, reason, req.id],
  );

  await notifyUser(req.user_id, {
    type: "retest_decided",
    title: "Permohonan pengujian ulang ditolak",
    body: `Alasan: ${reason}`,
    link: "/pengujian-baru",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
