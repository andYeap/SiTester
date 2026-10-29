import { NextResponse } from "next/server";

import { createSession, verifyCredentials } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

const MAX_FAILS = 10;
const WINDOW_MINUTES = 15;

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 45) || null;
  return null;
}

async function failuresSince(email: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM login_attempts
      WHERE success = false
        AND created_at >= now() - make_interval(mins => $1)
        AND email = $2`,
    [WINDOW_MINUTES, email],
  );
  return Number(row?.n ?? 0);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    remember?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const remember = body?.remember === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi." },
      { status: 422 },
    );
  }

  const ip = clientIp(request);
  if ((await failuresSince(email)) >= MAX_FAILS) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan gagal. Coba lagi setelah ${WINDOW_MINUTES} menit.` },
      { status: 429 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    await query(
      `INSERT INTO login_attempts (email, ip, success) VALUES ($1,$2,false)`,
      [email, ip],
    );
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 },
    );
  }

  await query(`DELETE FROM login_attempts WHERE email = $1`, [user.email]);

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
  }, { remember });

  return NextResponse.json({ user });
}
