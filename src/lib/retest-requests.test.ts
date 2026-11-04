import { beforeEach, describe, expect, it } from "vitest";

import { getPendingRetestRequests } from "@/lib/retest-requests";
import { query } from "@/lib/db";

import { createUser, resetDb, uid } from "../../tests/api/helpers";

describe("permohonan menunggu", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("tidak memuat permohonan kedaluwarsa", async () => {
    const tester = await createUser(undefined, "tester");
    const name = `Fitur Pending ${uid()}`;
    const feature = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [name],
    );

    const active = await query<{ id: number }>(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status, created_at, expires_at)
       VALUES ($1,$2,'tester','pending', now(), now() + interval '7 days')
       RETURNING id`,
      [tester.id, feature[0].id],
    );
    await query(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status, created_at, expires_at)
       VALUES ($1,$2,'tester','pending', now() - interval '10 days', now() - interval '3 days')`,
      [tester.id, feature[0].id],
    );

    const rows = (await getPendingRetestRequests()).filter(
      (r) => r.feature_name === name,
    );
    expect(rows.map((r) => Number(r.id))).toEqual([Number(active[0].id)]);
  });
});
