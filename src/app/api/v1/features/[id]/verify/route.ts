import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  const rows = await query<{ id: number; name: string }>(
    `UPDATE features SET verified=true, updated_at=now() WHERE id=$1 RETURNING id, name`,
    [Number(id)],
  );
  if (rows.length === 0) return err("Fitur tidak ditemukan.", 404);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "features.verify",
    target: rows[0].name,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}
