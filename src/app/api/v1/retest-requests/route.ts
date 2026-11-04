import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { query, queryOne, withTransaction } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import { getPendingRetestRequests } from "@/lib/retest-requests";

export async function GET() {
  if (!(await needKetua())) return err("Forbidden", 403);
  const pending = await getPendingRetestRequests();
  const reviewed = await query(
    `SELECT r.id, r.status, r.reason, r.rejection_reason, r.reviewed_at, r.tested_as_role, r.test_cycle,
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
    test_cycle?: unknown;
  } | null;

  const featureId = Number(body?.feature_id);
  const role = typeof body?.tested_as_role === "string" ? body.tested_as_role : "tester";
  const cycle = typeof body?.test_cycle === "string" && body.test_cycle.trim() !== "" ? body.test_cycle.trim() : null;
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

  if (cycle) {
    const cyc = await queryOne<{ name: string }>(
      `SELECT name FROM test_cycles WHERE name=$1 AND is_active=true`,
      [cycle],
    );
    if (!cyc) return err("Siklus tidak valid.", 422);
  }

  let createdId: number;
  try {
    createdId = await withTransaction(async (client) => {
      // Serialisasi permohonan per fitur agar dua request tidak lolos bersamaan.
      await client.query(`SELECT id FROM features WHERE id=$1 FOR UPDATE`, [
        featureId,
      ]);

      const last = await client.query<{ result: string }>(
        `SELECT result FROM test_sessions
          WHERE feature_id=$1 AND tested_as_role=$2
            AND test_cycle IS NOT DISTINCT FROM $3
          ORDER BY tested_at DESC, id DESC LIMIT 1`,
        [featureId, role, cycle],
      );
      if (last.rows.length === 0 || last.rows[0].result !== "pass") {
        throw Object.assign(
          new Error(
            "Permohonan pengujian ulang hanya diperlukan untuk fitur yang sudah lulus (Pass) pada pengujian sebelumnya.",
          ),
          { status: 422 },
        );
      }

      const approval = await client.query<{ id: number }>(
        `SELECT id FROM retest_approvals
          WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3
            AND test_cycle IS NOT DISTINCT FROM $4
            AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
          LIMIT 1`,
        [featureId, user.id, role, cycle],
      );
      if (approval.rows.length > 0) {
        throw Object.assign(
          new Error("Sudah ada persetujuan pengujian ulang yang masih berlaku."),
          { status: 422 },
        );
      }

      const dupInside = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM retest_requests
          WHERE feature_id=$1 AND tested_as_role=$2 AND test_cycle IS NOT DISTINCT FROM $3 AND status='pending' AND expires_at > now()`,
        [featureId, role, cycle],
      );
      if (dupInside.rows[0].n !== "0") {
        throw Object.assign(
          new Error(
            "Sudah ada permohonan pengujian ulang yang menunggu persetujuan untuk fitur dan peran ini.",
          ),
          { status: 422 },
        );
      }

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, test_cycle, reason, status)
         VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
        [user.id, featureId, role, cycle, reason],
      );
      return Number(inserted.rows[0].id);
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 422;
    return err(
      e instanceof Error ? e.message : "Gagal menyimpan permohonan.",
      status,
    );
  }

  await notifyRole("ketua_tim", {
    type: "retest_request",
    title: "Permohonan pengujian ulang baru",
    body: `${user.name} memohon uji ulang "${feature.name}" (${role})`,
    link: "/permohonan",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, id: createdId }, { status: 201 });
}
