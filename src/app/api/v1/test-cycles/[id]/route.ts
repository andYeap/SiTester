import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

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
    is_active?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" && body.description.trim() !== ""
      ? body.description.trim()
      : null;
  const isActive = body?.is_active !== false;

  if (!name || name.length > 100) {
    return err("Nama siklus wajib diisi (maks 100).", 422);
  }

  try {
    const rows = await query<{ id: number }>(
      `UPDATE test_cycles SET name=$1, description=$2, is_active=$3 WHERE id=$4 RETURNING id`,
      [name, description, isActive, Number(id)],
    );
    if (rows.length === 0) return err("Siklus tidak ditemukan.", 404);
  } catch {
    return err("Nama siklus sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_cycles.update",
    target: name,
    changes: { id, description, is_active: isActive },
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
