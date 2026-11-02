import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne } from "@/lib/db";
import { createResetToken, resetUrl } from "@/lib/reset";
import { isUuid } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;
  if (!isUuid(id)) return err("Pengguna tidak ditemukan.", 404);

  const user = await queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id=$1`,
    [id],
  );
  if (!user) return err("Pengguna tidak ditemukan.", 404);

  const token = await createResetToken(user.id);
  const url = resetUrl(new URL(request.url).origin, token);

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "users.reset_link",
    target: user.email,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, resetUrl: url, expiresHours: 24 });
}
