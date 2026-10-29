import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query } from "@/lib/db";

const NAME_RE = /^[a-z0-9_]+$/;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await needKetua())) return err("Forbidden", 403);
  const { name } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    label?: unknown;
    is_active?: unknown;
  } | null;

  const newName = typeof body?.name === "string" ? body.name.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const isActive = body?.is_active !== false;

  if (!newName || newName.length > 50 || !NAME_RE.test(newName)) {
    return err(
      "Nama peran hanya boleh huruf kecil, angka, dan garis bawah (maks 50).",
      422,
    );
  }
  if (!label || label.length > 100) {
    return err("Label wajib diisi (maks 100).", 422);
  }

  try {
    const rows = await query<{ name: string }>(
      `UPDATE testing_roles SET name=$1, label=$2, is_active=$3 WHERE name=$4 RETURNING name`,
      [newName, label, isActive, name],
    );
    if (rows.length === 0) return err("Peran tidak ditemukan.", 404);
  } catch {
    return err("Nama peran sudah dipakai.", 422);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await needKetua())) return err("Forbidden", 403);
  const { name } = await params;

  const used = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions WHERE tested_as_role=$1
     UNION ALL SELECT count(*)::text FROM retest_requests WHERE tested_as_role=$1`,
    [name],
  );
  if (used.some((r) => r.n !== "0")) {
    return err(
      "Peran tidak dapat dihapus karena sudah dipakai di riwayat. Nonaktifkan sebagai gantinya.",
      422,
    );
  }

  const rows = await query<{ name: string }>(
    `DELETE FROM testing_roles WHERE name=$1 RETURNING name`,
    [name],
  );
  if (rows.length === 0) return err("Peran tidak ditemukan.", 404);
  return NextResponse.json({ ok: true });
}
