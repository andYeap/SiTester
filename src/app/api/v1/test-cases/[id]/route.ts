import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

async function loadCase(id: string) {
  const caseId = parsePositiveInt(id);
  if (caseId === null) return null;
  const row = await queryOne<{
    id: number;
    feature_id: number;
    created_by: string | null;
    title: string;
  }>(
    `SELECT id, feature_id, created_by, title FROM test_cases WHERE id=$1`,
    [caseId],
  );
  return row;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const { id } = await params;
  const row = await loadCase(id);
  if (!row) return err("Test case tidak ditemukan.", 404);
  if (user.role !== "ketua_tim" && row.created_by !== user.id) {
    return err("Forbidden", 403);
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    steps?: unknown;
    expected?: unknown;
    is_active?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 255) {
    return err("Judul test case wajib diisi (maks 255).", 422);
  }
  const steps =
    typeof body?.steps === "string" && body.steps.trim() !== ""
      ? body.steps.trim()
      : null;
  const expected =
    typeof body?.expected === "string" && body.expected.trim() !== ""
      ? body.expected.trim()
      : null;
  const isActive = body?.is_active !== false;

  await queryOne(
    `UPDATE test_cases
        SET title=$1, steps=$2, expected=$3, is_active=$4, updated_at=now()
      WHERE id=$5 RETURNING id`,
    [title, steps, expected, isActive, row.id],
  );

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "test_cases.update",
    target: title,
    changes: { from: row.title, is_active: isActive },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const { id } = await params;
  const row = await loadCase(id);
  if (!row) return err("Test case tidak ditemukan.", 404);
  if (user.role !== "ketua_tim" && row.created_by !== user.id) {
    return err("Forbidden", 403);
  }

  await queryOne(`DELETE FROM test_cases WHERE id=$1 RETURNING id`, [row.id]);

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "test_cases.delete",
    target: row.title,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
