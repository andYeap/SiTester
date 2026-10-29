import { beforeEach, describe, expect, it } from "vitest";

import { GET as me } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

import { createUser, loginAs, resetDb, sessionCountFor, sessionToken } from "./helpers";

const req = (body: unknown) =>
  new Request("http://test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("auth", () => {
  let ketuaId = "";
  let ketuaEmail = "";
  let testerId = "";
  let testerEmail = "";

  beforeEach(async () => {
    await resetDb();
    const k = await createUser(undefined, "ketua_tim");
    ketuaId = k.id;
    ketuaEmail = k.email;
    const t = await createUser(undefined, "tester");
    testerId = t.id;
    testerEmail = t.email;
  });

  it("login sukses mengembalikan user + membuat sesi", async () => {
    const res = await login(req({ email: testerEmail, password: "password123" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { role: string } };
    expect(data.user.role).toBe("tester");
    expect(sessionToken()).toBeTruthy();
    expect(await sessionCountFor(testerId)).toBe(1);
  });

  it("login salah ditolak 401 tanpa sesi", async () => {
    const res = await login(req({ email: testerEmail, password: "salah" }));
    expect(res.status).toBe(401);
    expect(await sessionCountFor(testerId)).toBe(0);
  });

  it("me + logout", async () => {
    await loginAs(ketuaEmail);
    const meRes = await me();
    expect(meRes.status).toBe(200);
    const out = await logout();
    expect(out.status).toBe(200);
    expect(await sessionCountFor(ketuaId)).toBe(0);
  });
});
