import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return updateUser(request, (await params).id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return updateUser(request, (await params).id);
}

async function updateUser(request: Request, id: string) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  } | null;

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (body && "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 255) return err("Nama tidak valid.", 422);
    fields.push(`name=$${i++}`);
    values.push(name);
  }
  if (body && "email" in body) {
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return err("Email tidak valid.", 422);
    const dup = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE email=$1 AND id<>$2`,
      [email, id],
    );
    if (dup[0].n !== "0") return err("Email sudah dipakai.", 422);
    fields.push(`email=$${i++}`);
    values.push(email);
  }
  if (body && "password" in body && body.password !== "") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) return err("Password minimal 8 karakter.", 422);
    fields.push(`password_hash=$${i++}`);
    values.push(await hashPassword(password));
  }
  if (body && "role" in body) {
    if (body.role !== "tester" && body.role !== "ketua_tim")
      return err("Role tidak valid.", 422);
    if (id === ketua.id && body.role !== "ketua_tim") {
      return err("Tidak dapat menurunkan role diri sendiri.", 422);
    }
    fields.push(`role=$${i++}`);
    values.push(body.role);
  }
  if (fields.length === 0) return err("Tidak ada perubahan.", 422);

  fields.push(`updated_at=now()`);
  values.push(id);
  const rows = await query<{ id: string; email: string }>(
    `UPDATE users SET ${fields.join(", ")} WHERE id=$${i} RETURNING id, email`,
    values,
  );
  if (rows.length === 0) return err("Pengguna tidak ditemukan.", 404);
    const safeChanges: Record<string, unknown> = { ...(body ?? {}) };
    if ("password" in safeChanges) {
      safeChanges.password_changed = safeChanges.password !== "";
      delete safeChanges.password;
    }
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "users.update",
    target: rows[0].email,
    changes: { ...safeChanges, password_changed: "password" in (body ?? {}) },
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const { id } = await params;

  if (id === ketua.id) {
    return err("Anda tidak dapat menghapus akun sendiri.", 422);
  }

  const refs = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions WHERE user_id=$1
     UNION ALL SELECT count(*)::text FROM retest_requests WHERE user_id=$1
     UNION ALL SELECT count(*)::text FROM retest_approvals WHERE requested_by=$1
     UNION ALL SELECT count(*)::text FROM retest_approvals WHERE approved_by=$1`,
    [id],
  );
  if (refs.some((r) => r.n !== "0")) {
    return err(
      "Pengguna tidak dapat dihapus karena memiliki riwayat terkait.",
      422,
    );
  }

  const rows = await query<{ id: string; email: string }>(
    `DELETE FROM users WHERE id=$1 RETURNING id, email`,
    [id],
  );
  if (rows.length === 0) return err("Pengguna tidak ditemukan.", 404);
  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "users.delete",
    target: rows[0].email,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}
