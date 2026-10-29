import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { notifyRole } from "@/lib/notify";

export async function GET() {
  if (!(await needKetua())) return err("Forbidden", 403);
  const pending = await query(
    `SELECT r.id, r.reason, r.created_at, r.tested_as_role,
            f.name AS feature_name, u.name AS user_name
       FROM retest_requests r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.user_id
      WHERE r.status='pending' AND r.expires_at > now() ORDER BY r.created_at DESC`,
  );
  const reviewed = await query(
    `SELECT r.id, r.status, r.reason, r.rejection_reason, r.reviewed_at, r.tested_as_role,
            f.name AS feature_name, u.name AS user_name, rv.name AS reviewer_name
       FROM retest_requests r
       JOIN features f ON f.id = r.feature_id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN users rv ON rv.id = r.reviewed_by
      WHERE r.status <> 'pending' ORDER BY r.reviewed_at DESC LIMIT 20`,
  );
  return NextResponse.json({ pending, reviewed });
}

export async function POST(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as {
    feature_id?: unknown;
    tested_as_role?: unknown;
    reason?: unknown;
  } | null;

  const featureId = Number(body?.feature_id);
  const role = typeof body?.tested_as_role === "string" ? body.tested_as_role : "tester";
  const reason =
    typeof body?.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim().slice(0, 1000)
      : null;

  if (!Number.isInteger(featureId)) return err("Fitur tidak valid.", 422);

  const feature = await queryOne<{ id: number; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM features WHERE id=$1`,
    [featureId],
  );
  if (!feature || !feature.is_active) {
    return err("Fitur yang dipilih tidak aktif atau tidak ditemukan.", 422);
  }

  const roleOk = await queryOne<{ name: string }>(
    `SELECT name FROM testing_roles WHERE name=$1 AND is_active=true`,
    [role],
  );
  if (!roleOk) return err("Peran pengujian tidak valid.", 422);

  const dup = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests
      WHERE feature_id=$1 AND tested_as_role=$2 AND status='pending' AND expires_at > now()`,
    [featureId, role],
  );
  if (dup[0].n !== "0") {
    return err(
      "Sudah ada permohonan pengujian ulang yang menunggu persetujuan untuk fitur dan peran ini.",
      422,
    );
  }

  await query(
    `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, reason, status)
     VALUES ($1,$2,$3,$4,'pending')`,
    [user.id, featureId, role, reason],
  );

  await notifyRole("ketua_tim", {
    type: "retest_request",
    title: "Permohonan pengujian ulang baru",
    body: `${user.name} memohon uji ulang "${feature.name}" (${role})`,
    link: "/permohonan",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true }, { status: 201 });
}
