import { NextResponse } from "next/server";

import { err, needKetua, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query, withTransaction } from "@/lib/db";

export async function GET() {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const isKetua = user.role === "ketua_tim";
  const rows = await query<{
    id: number;
    name: string;
    description: string | null;
    brief: string | null;
    is_active: boolean;
    test_count: number;
    scope_count: number;
    feature_ids: number[] | null;
  }>(
    `SELECT c.id, c.name, c.description, c.brief, c.is_active,
            (SELECT count(*)::int FROM test_sessions s WHERE s.test_cycle = c.name) AS test_count,
            (SELECT count(*)::int FROM cycle_features cf WHERE cf.cycle_id = c.id) AS scope_count,
            (SELECT coalesce(array_agg(cf.feature_id), '{}') FROM cycle_features cf WHERE cf.cycle_id = c.id) AS feature_ids
       FROM test_cycles c
      ${isKetua ? "" : "WHERE c.is_active = true"}
      ORDER BY c.name`,
  );
  return NextResponse.json({ cycles: rows });
}

export async function POST(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
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
    : [];

  if (!name || name.length > 100) {
    return err("Nama siklus wajib diisi (maks 100).", 422);
  }

  if (featureIds.length > 0) {
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
      const created = await client.query<{ id: number }>(
        `INSERT INTO test_cycles (name, description, brief, is_active) VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, description, brief, isActive],
      );
      for (const fid of featureIds) {
        await client.query(
          `INSERT INTO cycle_features (cycle_id, feature_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [created.rows[0].id, fid],
        );
      }
    });
  } catch {
    return err("Nama siklus sudah dipakai.", 422);
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_cycles.create",
    target: name,
    changes: { description, brief, is_active: isActive, feature_count: featureIds.length },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
