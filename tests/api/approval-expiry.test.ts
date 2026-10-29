import { beforeEach, describe, expect, it } from "vitest";

import { POST as submit } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb } from "./helpers";

const fd = (obj: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    f.set(k, v);
  }
  return new Request("http://test/x", { method: "POST", body: f });
};

describe("approval kedaluwarsa", () => {
  let fid = 0;
  let testerId = "";

  beforeEach(async () => {
    await resetDb();
    await createUser(undefined, "ketua_tim");
    const tester = await createUser(undefined, "tester");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('Fitur Exp',true,true) RETURNING id`,
    );
    fid = f[0].id;
    const login = await loginAs(tester.email);
    testerId = login.user.id;
    const r = await submit(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(201);
  });

  it("approval kedaluwarsa tidak bisa dipakai", async () => {
    await query(
      `INSERT INTO retest_approvals (feature_id, requested_by, approved_by, scope_role, used_at, expires_at)
       VALUES ($1,$2,$2,'tester',NULL, now() - interval '1 day')`,
      [fid, testerId],
    );

    const r = await submit(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(422);
  });

  it("approval baru mendapat TTL 7 hari dan bisa dipakai", async () => {
    // simulasi approve ketua: buat approval aktif seperti kode approve
    await query(
      `INSERT INTO retest_approvals (feature_id, requested_by, approved_by, scope_role, used_at, expires_at)
       VALUES ($1,$2,$2,'tester',NULL, now() + make_interval(days => 7))`,
      [fid, testerId],
    );

    const r = await submit(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(201);
  });
});
