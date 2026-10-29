import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET() {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const isKetua = user.role === "ketua_tim";
  const rows = await query(
    `SELECT c.id, c.name, c.description, c.is_active,
            (SELECT count(*)::int FROM test_sessions s WHERE s.test_cycle = c.name) AS test_count
       FROM test_cycles c
      ${isKetua ? "" : "WHERE c.is_active = true"}
      ORDER BY c.name`,
  );
  return NextResponse.json({ cycles: rows });
}

export async function POST(request: Request) {
  if (!(await needKetua())) return err("Forbidden", 403);
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
    await query(
      `INSERT INTO test_cycles (name, description, is_active) VALUES ($1,$2,$3)`,
      [name, description, isActive],
    );
  } catch {
    return err("Nama siklus sudah dipakai.", 422);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
