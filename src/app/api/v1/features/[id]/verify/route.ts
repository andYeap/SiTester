import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query } from "@/lib/db";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await needKetua())) return err("Forbidden", 403);
  const { id } = await params;

  const rows = await query<{ id: number }>(
    `UPDATE features SET verified=true, updated_at=now() WHERE id=$1 RETURNING id`,
    [Number(id)],
  );
  if (rows.length === 0) return err("Fitur tidak ditemukan.", 404);
  return NextResponse.json({ ok: true });
}
