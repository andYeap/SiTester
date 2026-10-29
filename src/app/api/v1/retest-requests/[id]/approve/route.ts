import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { withTransaction } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  try {
    await withTransaction(async (client) => {
      const found = await client.query<{
        id: number;
        user_id: string;
        feature_id: number;
        tested_as_role: string;
        status: string;
      }>(
        `SELECT id, user_id, feature_id, tested_as_role, status FROM retest_requests WHERE id=$1 FOR UPDATE`,
        [Number(id)],
      );
      if (found.rows.length === 0) {
        throw Object.assign(new Error("Permohonan tidak ditemukan."), { status: 404 });
      }
      const req = found.rows[0];
      if (req.status !== "pending") {
        throw Object.assign(new Error("Permohonan ini sudah diproses."), { status: 422 });
      }

      await client.query(
        `UPDATE retest_requests SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE id=$2`,
        [ketua.id, req.id],
      );
      await client.query(
        `INSERT INTO retest_approvals (feature_id, requested_by, approved_by, scope_role, expires_at)
         VALUES ($1,$2,$3,$4, now() + make_interval(days => 7))`,
        [req.feature_id, req.user_id, ketua.id, req.tested_as_role],
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
