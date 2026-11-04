import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { withTransaction } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { parsePositiveInt } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;
  const requestId = parsePositiveInt(id);
  if (requestId === null) return err("Permohonan tidak ditemukan.", 404);

  const body = (await request.json().catch(() => null)) as {
    rejection_reason?: unknown;
  } | null;
  const reason =
    typeof body?.rejection_reason === "string" ? body.rejection_reason.trim() : "";
  if (!reason || reason.length > 1000) {
    return err("Alasan penolakan wajib diisi.", 422);
  }

  const outcome = await withTransaction(async (client) => {
    const found = await client.query<{
      id: number;
      user_id: string;
      status: string;
      expires_at: string;
    }>(
      `SELECT id, user_id, status, expires_at FROM retest_requests
        WHERE id=$1 FOR UPDATE`,
      [requestId],
    );
    if (found.rows.length === 0) return { error: "notfound" } as const;
    const req = found.rows[0];
    if (req.status !== "pending") return { error: "processed" } as const;
    if (new Date(req.expires_at).getTime() <= Date.now()) {
      return { error: "expired" } as const;
    }

    await client.query(
      `UPDATE retest_requests
          SET status='rejected', reviewed_by=$1, reviewed_at=now(), rejection_reason=$2
        WHERE id=$3`,
      [ketua.id, reason, req.id],
    );
    return { userId: req.user_id } as const;
  });

  if ("error" in outcome) {
    if (outcome.error === "notfound") {
      return err("Permohonan tidak ditemukan.", 404);
    }
    if (outcome.error === "expired") {
      return err("Permohonan ini sudah kedaluwarsa.", 410);
    }
    return err("Permohonan ini sudah diproses.", 422);
  }

  await notifyUser(outcome.userId, {
    type: "retest_decided",
    title: "Permohonan pengujian ulang ditolak",
    body: `Alasan: ${reason}`,
    link: "/pengujian-baru",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
