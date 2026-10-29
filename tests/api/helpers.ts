import { createHash, randomBytes } from "node:crypto";

import { cookieStore } from "./cookie-store";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export { cookieStore };

export const uid = () => randomBytes(4).toString("hex");

export async function resetDb() {
  // Tanpa TRUNCATE: file test berjalan paralel di DB yang sama.
  // Isolasi dicapai via nama/email unik per test + seed idempoten.
  await query(
    `INSERT INTO testing_roles (name, label, is_active) VALUES
      ('super_admin','Super Admin',true),
      ('admin_instansi','Admin Instansi',true),
      ('tester','Tester',true)
     ON CONFLICT (name) DO NOTHING`,
  );
  cookieStore().clear();
}

export async function createUser(
  email?: string,
  role: "tester" | "ketua_tim" = "tester",
  password = "password123",
) {
  const em = email ?? `u-${uid()}@t.test`;
  const rows = await query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [em.split("@")[0], em, await hashPassword(password), role],
  );
  return { ...rows[0], email: em };
}

/** Login lewat route asli; token sesi tersimpan di mock cookie store. */
export async function loginAs(email: string, password = "password123") {
  const { POST } = await import("@/app/api/auth/login/route");
  const res = await POST(
    new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  if (res.status !== 200) {
    throw new Error(`login gagal (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as {
    user: { id: string; role: string };
  };
}

export function sessionToken(): string | undefined {
  return cookieStore().get("testlab_session");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sessionCountFor(userId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sessions WHERE user_id=$1`,
    [userId],
  );
  return Number(rows[0].n);
}

export { randomBytes };
