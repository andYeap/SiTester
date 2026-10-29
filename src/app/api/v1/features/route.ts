import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const activeOnly = new URL(request.url).searchParams.get("active") === "1";
  const cycleScope = new URL(request.url).searchParams.get("cycle")?.trim() || null;
  let cycleFilter = "";
  const cycleVals: unknown[] = [];
  if (cycleScope) {
    const scoped = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM cycle_features cf
        JOIN test_cycles c ON c.id = cf.cycle_id WHERE c.name = $1`,
      [cycleScope],
    );
    if (Number(scoped[0].n) > 0) {
      cycleFilter = `AND f.id IN (SELECT cf.feature_id FROM cycle_features cf JOIN test_cycles c ON c.id = cf.cycle_id WHERE c.name = $1)`;
      cycleVals.push(cycleScope);
    }
  }
  const rows = await query(
    `SELECT f.id, f.name, f.description, f.project_name, f.is_active, f.verified,
            u.name AS creator_name,
            (SELECT count(*)::int FROM test_sessions s WHERE s.feature_id = f.id) AS test_count
       FROM features f LEFT JOIN users u ON u.id = f.created_by
      ${activeOnly ? "WHERE f.is_active = true" : "WHERE true"}
      ${cycleFilter}
      ORDER BY f.name`,
    cycleVals,
  );
  return NextResponse.json({ features: rows });
}

export async function POST(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    project_name?: unknown;
    is_active?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" && body.description.trim() !== ""
      ? body.description.trim()
      : null;
  const projectName =
    typeof body?.project_name === "string" && body.project_name.trim() !== ""
      ? body.project_name.trim()
      : null;
  const isActive = body?.is_active !== false;

  if (!name || name.length > 255) {
    return err("Nama fitur wajib diisi (maks 255).", 422);
  }

  const dup = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM features WHERE LOWER(name) = LOWER($1)`,
    [name],
  );
  if (dup[0].n !== "0") {
    return err(
      "Nama fitur sudah ada di daftar. Gunakan fitur yang sudah ada.",
      422,
    );
  }

  const isKetua = user.role === "ketua_tim";
  await query(
    `INSERT INTO features (name, description, project_name, is_active, verified, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [name, description, projectName, isActive, isKetua, user.id],
  );
  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "features.create",
    target: name,
    changes: { project_name: projectName, is_active: isActive },
    ip: clientIp(request),
  });

  return NextResponse.json(
    {
      ok: true,
      message: isKetua
        ? "Fitur berhasil ditambahkan."
        : "Usulan fitur berhasil ditambahkan dan langsung bisa dipakai. Ketua tim akan memverifikasinya.",
    },
    { status: 201 },
  );
}
