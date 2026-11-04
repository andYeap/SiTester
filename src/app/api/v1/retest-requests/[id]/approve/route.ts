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
    note?: unknown;
  } | null;
  const note =
    typeof body?.note === "string" && body.note.trim() !== ""
      ? body.note.trim().slice(0, 1000)
      : null;

  try {
    await withTransaction(async (client) => {
      const found = await client.query<{
        id: number;
        user_id: string;
        feature_id: number;
        tested_as_role: string;
        test_cycle: string | null;
        status: string;
        expires_at: string;
      }>(
        `SELECT id, user_id, feature_id, tested_as_role, test_cycle, status, expires_at FROM retest_requests WHERE id=$1 FOR UPDATE`,
        [requestId],
      );
      if (found.rows.length === 0) {
        throw Object.assign(new Error("Permohonan tidak ditemukan."), { status: 404 });
      }
      const req = found.rows[0];
      if (req.status !== "pending") {
        throw Object.assign(new Error("Permohonan ini sudah diproses."), { status: 422 });
      }
      if (new Date(req.expires_at).getTime() <= Date.now()) {
        throw Object.assign(new Error("Permohonan ini sudah kedaluwarsa. Silakan ajukan permohonan baru."), { status: 410 });
      }

      await client.query(
        `UPDATE retest_requests SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE id=$2`,
        [ketua.id, req.id],
      );
      await client.query(
        `INSERT INTO retest_approvals (feature_id, requested_by, approved_by, scope_role, test_cycle, expires_at, note)
         VALUES ($1,$2,$3,$4,$5, now() + make_interval(days => 7), $6)`,
        [req.feature_id, req.user_id, ketua.id, req.tested_as_role, req.test_cycle, note],
      );

      await notifyUser(req.user_id, {
        type: "retest_decided",
        title: "Permohonan pengujian ulang disetujui",
        body: `Ketua tim menyetujui uji ulang untuk peran ${req.tested_as_role}.`,
        link: "/pengujian-baru",
      }).catch(() => undefined);
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 422;
    return err(e instanceof Error ? e.message : "Gagal.", status);
  }
}
