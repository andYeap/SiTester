import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function GET() {
  if (!(await needKetua())) return err("Forbidden", 403);
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            (SELECT count(*)::int FROM test_sessions s WHERE s.user_id = u.id) AS test_count
       FROM users u ORDER BY u.name`,
  );
  return NextResponse.json({ users: rows });
}

export async function POST(request: Request) {
  if (!(await needKetua())) return err("Forbidden", 403);
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role === "ketua_tim" ? "ketua_tim" : "tester";

  if (!name || name.length > 255) return err("Nama wajib diisi.", 422);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return err("Email tidak valid.", 422);
  if (password.length < 8)
    return err("Password minimal 8 karakter.", 422);

  try {
    await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)`,
      [name, email, await hashPassword(password), role],
    );
  } catch {
    return err("Email sudah dipakai.", 422);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
