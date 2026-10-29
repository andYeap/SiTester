import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query, withTransaction } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    brief?: unknown;
    is_active?: unknown;
    feature_ids?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" && body.description.trim() !== ""
      ? body.description.trim()
      : null;
  const brief =
    typeof body?.brief === "string" && body.brief.trim() !== ""
      ? body.brief.trim().slice(0, 2000)
      : null;
  const isActive = body?.is_active !== false;
  const featureIds = Array.isArray(body?.feature_ids)
    ? [...new Set(body.feature_ids.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))]
    : null;

  if (!name || name.length > 100) {
    return err("Nama siklus wajib diisi (maks 100).", 422);
  }

  if (featureIds !== null && featureIds.length > 0) {
    const found = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM features WHERE id = ANY($1) AND is_active = true`,
      [featureIds],
    );
    if (Number(found[0].n) !== featureIds.length) {
      return err("Ada fitur dalam lingkup yang tidak valid atau nonaktif.", 422);
    }
  }

  try {
    await withTransaction(async (client) => {
      const updated = await client.query<{ id: number }>(
        `UPDATE test_cycles SET name=$1, description=$2, brief=$3, is_active=$4 WHERE id=$5 RETURNING id`,
        [name, description, brief, isActive, Number(id)],
      );
      if (updated.rows.length === 0) throw new Error("Siklus tidak ditemukan.");
      if (featureIds !== null) {
        await client.query(`DELETE FROM cycle_features WHERE cycle_id=$1`, [Number(id)]);
        for (const fid of featureIds) {
          await client.query(
            `INSERT INTO cycle_features (cycle_id, feature_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [Number(id), fid],
          );
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Siklus tidak ditemukan.") {
      return err(e.message, 404);
    }
    return err("Nama siklus sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_cycles.update",
    target: name,
    changes: { id, description, brief, is_active: isActive, feature_count: featureIds?.length ?? undefined },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  const row = await query<{ name: string }>(
    `SELECT name FROM test_cycles WHERE id=$1`,
    [Number(id)],
  );
  if (row.length === 0) return err("Siklus tidak ditemukan.", 404);

  const used = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions WHERE test_cycle=$1`,
    [row[0].name],
  );
  if (used[0].n !== "0") {
    return err(
      "Siklus tidak dapat dihapus karena sudah dipakai di riwayat pengujian. Nonaktifkan sebagai gantinya.",
      422,
    );
  }

  await query(`DELETE FROM test_cycles WHERE id=$1`, [Number(id)]);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_cycles.delete",
    target: row[0].name,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}
