import { NextResponse } from "next/server";

import { err, needKetua, type SessionUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

async function updateFeature(request: Request, id: string, ketua: SessionUser) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    project_name?: unknown;
    is_active?: unknown;
    verified?: unknown;
  } | null;

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (body && "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 255) return err("Nama fitur tidak valid.", 422);
    const dup = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM features WHERE LOWER(name) = LOWER($1) AND id <> $2`,
      [name, Number(id)],
    );
    if (dup[0].n !== "0")
      return err("Nama fitur sudah dipakai fitur lain.", 422);
    fields.push(`name=$${i++}`);
    values.push(name);
  }
  if (body && "description" in body) {
    fields.push(`description=$${i++}`);
    values.push(
      typeof body.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null,
    );
  }
  if (body && "project_name" in body) {
    const pName =
      typeof body.project_name === "string" && body.project_name.trim() !== ""
        ? body.project_name.trim()
        : null;
    if (pName !== null) {
      const ok = await query<{ n: string }>(
        `SELECT count(*)::text AS n FROM projects WHERE name = $1 AND is_active = true`,
        [pName],
      );
      if (ok[0].n !== "1") {
        return err("Proyek tidak terdaftar atau nonaktif. Pilih dari daftar Proyek.", 422);
      }
    }
    fields.push(`project_name=$${i++}`);
    values.push(pName);
  }
  if (body && "is_active" in body) {
    fields.push(`is_active=$${i++}`);
    values.push(body.is_active !== false);
  }
  if (body && "verified" in body) {
    fields.push(`verified=$${i++}`);
    values.push(body.verified === true);
  }
  if (fields.length === 0) return err("Tidak ada perubahan.", 422);

  fields.push(`updated_at=now()`);
  values.push(Number(id));
  const rows = await query<{ id: number; name: string }>(
    `UPDATE features SET ${fields.join(", ")} WHERE id=$${i} RETURNING id, name`,
    values,
  );
  if (rows.length === 0) return err("Fitur tidak ditemukan.", 404);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "features.update",
    target: rows[0].name,
    changes: body ?? undefined,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  return updateFeature(request, (await params).id, ketua);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  return updateFeature(request, (await params).id, ketua);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  const used = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1
     UNION ALL SELECT count(*)::text FROM retest_requests WHERE feature_id=$1
     UNION ALL SELECT count(*)::text FROM retest_approvals WHERE feature_id=$1`,
    [Number(id)],
  );
  if (used.some((r) => r.n !== "0")) {
    return err(
      "Fitur tidak dapat dihapus karena sudah memiliki riwayat pengujian. Nonaktifkan sebagai gantinya.",
      422,
    );
  }

  const rows = await query<{ id: number; name: string }>(
    `DELETE FROM features WHERE id=$1 RETURNING id, name`,
    [Number(id)],
  );
  if (rows.length === 0) return err("Fitur tidak ditemukan.", 404);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "features.delete",
    target: rows[0].name,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}
