import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

const NAME_RE = /^[a-z0-9_]+$/;

export async function GET() {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const isKetua = user.role === "ketua_tim";
  const rows = await query(
    `SELECT name, label, is_active FROM testing_roles
      ${isKetua ? "" : "WHERE is_active = true"}
      ORDER BY name`,
  );
  return NextResponse.json({ roles: rows });
}

export async function POST(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    label?: unknown;
    is_active?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const isActive = body?.is_active !== false;

  if (!name || name.length > 50 || !NAME_RE.test(name)) {
    return err(
      "Nama peran hanya boleh huruf kecil, angka, dan garis bawah (maks 50).",
      422,
    );
  }
  if (!label || label.length > 100) {
    return err("Label wajib diisi (maks 100).", 422);
  }

  try {
    await query(
      `INSERT INTO testing_roles (name, label, is_active) VALUES ($1,$2,$3)`,
      [name, label, isActive],
    );
  } catch {
    return err("Nama peran sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "testing_roles.create",
    target: name,
    changes: { label, is_active: isActive },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
