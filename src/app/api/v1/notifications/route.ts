import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
  const rows = await query(
    `SELECT id, type, title, body, link, read_at, created_at FROM notifications
      WHERE user_id=$1 ${unreadOnly ? "AND read_at IS NULL" : ""}
      ORDER BY created_at DESC LIMIT 50`,
    [user.id],
  );
  return NextResponse.json({ notifications: rows });
}

export async function POST(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    all?: unknown;
  } | null;

  if (body?.all === true) {
    await query(
      `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`,
      [user.id],
    );
    return NextResponse.json({ ok: true });
  }

  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter((v): v is number => Number.isInteger(v))
    : [];
  if (ids.length === 0) return err("Tidak ada notifikasi dipilih.", 422);

  await query(
    `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id = ANY($2)`,
    [user.id, ids],
  );
  return NextResponse.json({ ok: true });
}
