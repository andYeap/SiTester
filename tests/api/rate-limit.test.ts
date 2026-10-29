import { beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { query } from "@/lib/db";

import { createUser, resetDb } from "./helpers";

const req = (email: string, password: string) =>
  new Request("http://test/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "9.9.9.9",
    },
    body: JSON.stringify({ email, password }),
  });

describe("rate limit login", () => {
  let email = "";

  beforeEach(async () => {
    await resetDb();
    email = (await createUser(undefined, "tester")).email;
  });

  it("10x salah lalu diblokir 429 walau password benar", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await login(req(email, "salah"));
      expect([401, 429].includes(r.status)).toBe(true);
    }
    const blocked = await login(req(email, "password123"));
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string };
    expect(body.error).toMatch(/coba lagi|menit|terlalu/i);
  });

  it("login benar menghapus hitungan gagal", async () => {
    for (let i = 0; i < 3; i++) {
      await login(req(email, "salah"));
    }
    const ok = await login(req(email, "password123"));
    expect(ok.status).toBe(200);

    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM login_attempts WHERE email=$1`,
      [email],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});
