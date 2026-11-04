import { beforeEach, describe, expect, it } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

function fd(featureId: number) {
  const f = new FormData();
  f.set("tested_at", "2026-10-29");
  f.set("feature_id", String(featureId));
  f.set("is_retest", "0");
  f.set("tested_as_role", "tester");
  f.set("result", "pass");
  return new Request("http://test/api/v1/test-sessions", {
    method: "POST",
    body: f,
  });
}

describe("balapan pengujian", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("dua Pass bersamaan hanya menyimpan satu sesi", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Race ${uid()}`],
    );

    const results = await Promise.all([
      submitSession(fd(f[0].id)),
      submitSession(fd(f[0].id)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);

    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1`,
      [f[0].id],
    );
    expect(rows[0].n).toBe("1");
  });
});
