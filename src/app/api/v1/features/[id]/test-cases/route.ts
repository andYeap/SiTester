import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query, queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const featureId = parsePositiveInt((await params).id);
  if (featureId === null) return err("Fitur tidak ditemukan.", 404);

  const feature = await queryOne<{ id: number }>(
    `SELECT id FROM features WHERE id=$1`,
    [featureId],
  );
  if (!feature) return err("Fitur tidak ditemukan.", 404);

  const rows = await query(
    `SELECT id, feature_id, title, steps, expected, is_active, created_by, created_at
       FROM test_cases
      WHERE feature_id=$1 ${user.role === "ketua_tim" ? "" : "AND is_active=true"}
      ORDER BY is_active DESC, title`,
    [featureId],
  );

  return NextResponse.json({ testCases: rows });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const featureId = parsePositiveInt((await params).id);
  if (featureId === null) return err("Fitur tidak ditemukan.", 404);

  const feature = await queryOne<{ id: number; name: string }>(
    `SELECT id, name FROM features WHERE id=$1`,
    [featureId],
  );
  if (!feature) return err("Fitur tidak ditemukan.", 404);

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    steps?: unknown;
    expected?: unknown;
    is_active?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const steps =
    typeof body?.steps === "string" && body.steps.trim() !== ""
      ? body.steps.trim()
      : null;
  const expected =
    typeof body?.expected === "string" && body.expected.trim() !== ""
      ? body.expected.trim()
      : null;
  const isActive = body?.is_active !== false;

  if (!title || title.length > 255) {
    return err("Judul test case wajib diisi (maks 255).", 422);
  }

  const inserted = await queryOne<{ id: number }>(
    `INSERT INTO test_cases (feature_id, title, steps, expected, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [featureId, title, steps, expected, isActive, user.id],
  );

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "test_cases.create",
    target: `${feature.name}: ${title}`,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, id: Number(inserted?.id) }, { status: 201 });
}
