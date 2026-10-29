import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "testlab_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const REMEMBER_ME_TTL_SECONDS = 30 * 24 * 60 * 60;

export type Role = "tester" | "ketua_tim";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type UserRow = SessionUser & {
  password_hash: string;
};

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
  opts: { remember?: boolean } = {},
) {
  const token = randomBytes(32).toString("base64url");
  const ttl = opts.remember ? REMEMBER_ME_TTL_SECONDS : SESSION_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  // Satu akun = satu sesi aktif. Login baru mencabut sesi lama.
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashToken(token), userId, expiresAt, meta.userAgent ?? null, meta.ip ?? null],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return expiresAt;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`DELETE FROM sessions WHERE id = $1`, [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await queryOne<UserRow>(
    `SELECT u.id, u.name, u.email, u.role, u.password_hash
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > now()`,
    [hashToken(token)],
  );

  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

export async function requireKetua(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ketua_tim") {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await queryOne<UserRow>(
    `SELECT id, name, email, role, password_hash FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  if (!user) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
