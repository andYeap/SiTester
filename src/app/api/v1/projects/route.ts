import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

export async function GET() {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const isKetua = user.role === "ketua_tim";
  const rows = await query<{
    id: number;
    name: string;
    is_active: boolean;
    test_count: number;
    feature_count: number;
  }>(
    `SELECT p.id, p.name, p.is_active,
            (SELECT count(*)::int FROM test_sessions s JOIN features f ON f.id = s.feature_id WHERE f.project_name = p.name) AS test_count,
            (SELECT count(*)::int FROM features f WHERE f.project_name = p.name) AS feature_count
       FROM projects p
      ${isKetua ? "" : "WHERE p.is_active = true"}
      ORDER BY p.name`,
  );
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
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
    await query("INSERT INTO projects (name, is_active) VALUES ($1,$2)", [
      name,
      isActive,
    ]);
  } catch {
    return err("Nama proyek sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "projects.create",
    target: name,
    changes: { is_active: isActive },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
