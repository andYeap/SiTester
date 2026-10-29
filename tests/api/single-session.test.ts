import { beforeEach, describe, expect, it } from "vitest";

import { GET as me } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";

import { cookieStore, createUser, resetDb } from "./helpers";

const req = (email: string, password: string) =>
  new Request("http://test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

describe("satu akun satu sesi aktif", () => {
  let email = "";

  beforeEach(async () => {
    await resetDb();
    email = (await createUser(undefined, "tester")).email;
  });

  it("login kedua mencabut sesi pertama", async () => {
    const r1 = await login(req(email, "password123"));
    expect(r1.status).toBe(200);
    const token1 = cookieStore().get("testlab_session");
    expect(token1).toBeTruthy();

    const r2 = await login(req(email, "password123"));
    expect(r2.status).toBe(200);
    const token2 = cookieStore().get("testlab_session");
    expect(token2).toBeTruthy();
    expect(token2).not.toBe(token1);

    // sesi lama tidak berlaku lagi
    cookieStore().set("testlab_session", token1!);
    expect((await me()).status).toBe(401);

    // sesi baru berlaku
    cookieStore().set("testlab_session", token2!);
    expect((await me()).status).toBe(200);
  });
});
