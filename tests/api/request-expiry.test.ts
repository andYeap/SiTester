import { beforeEach, describe, expect, it } from "vitest";

import { query } from "@/lib/db";

import { createUser, loginAs, resetDb } from "./helpers";

const json = (body: unknown) =>
  new Request("http://test/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("permohonan kedaluwarsa", () => {
  let fid = 0;
  let testerId = "";

  beforeEach(async () => {
    await resetDb();
    await createUser(undefined, "ketua_tim");
    const t = await createUser(undefined, "tester");
    testerId = t.id;
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('Fitur Exp Req',true,true) RETURNING id`,
    );
    fid = f[0].id;
    await loginAs(t.email);
  });

  it("permohonan basi tidak menghalangi ajuan baru", async () => {
    const { POST: requestRetest } = await import("@/app/api/v1/retest-requests/route");
    // permohonan lama yang sudah kedaluwarsa
    await query(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status, created_at, expires_at)
       VALUES ($1,$2,'tester','pending', now() - interval '10 days', now() - interval '3 days')`,
      [testerId, fid],
    );

    const r = await requestRetest(
      json({ feature_id: fid, tested_as_role: "tester" }),
    );
    expect(r.status).toBe(201);
  });

  it("ajukan baru tetap membuat expires_at 7 hari ke depan", async () => {
    const { POST: requestRetest } = await import("@/app/api/v1/retest-requests/route");
    const r = await requestRetest(
      json({ feature_id: fid, tested_as_role: "tester" }),
    );
    expect(r.status).toBe(201);

    const row = await query<{ expires_at: string }>(
      `SELECT expires_at::text AS expires_at FROM retest_requests WHERE feature_id=$1`,
      [fid],
    );
    const diffDays =
      (new Date(row[0].expires_at).getTime() - Date.now()) / 86400000;
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });
});
