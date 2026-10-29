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
    is_active?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const isActive = body?.is_active !== false;

  if (!name || name.length > 100) {
    return err("Nama proyek wajib diisi (maks 100).", 422);
  }

  try {
    await withTransaction(async (client) => {
      const old = await client.query<{ name: string }>(
        `SELECT name FROM projects WHERE id=$1 FOR UPDATE`,
        [Number(id)],
      );
      if (old.rows.length === 0) throw new Error("Proyek tidak ditemukan.");
      await client.query(`UPDATE projects SET name=$1, is_active=$2 WHERE id=$3`, [
        name,
        isActive,
        Number(id),
      ]);
      if (old.rows[0].name !== name) {
        await client.query(`UPDATE features SET project_name=$1 WHERE project_name=$2`, [
          name,
          old.rows[0].name,
        ]);
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Proyek tidak ditemukan.") {
      return err(e.message, 404);
    }
    return err("Nama proyek sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "projects.update",
    target: name,
    changes: { id, is_active: isActive },
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

  const row = await query<{ id: number; name: string }>(
    `SELECT id, name FROM projects WHERE id=$1`,
    [Number(id)],
  );
  if (row.length === 0) return err("Proyek tidak ditemukan.", 404);

  const used = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM features WHERE project_name=$1`,
    [row[0].name],
  );
  if (used[0].n !== "0") {
    return err(
      "Proyek tidak dapat dihapus karena masih dipakai fitur. Nonaktifkan atau pindahkan dulu fitur-fiturnya.",
      422,
    );
  }

  await query(`DELETE FROM projects WHERE id=$1`, [Number(id)]);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "projects.delete",
    target: row[0].name,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
