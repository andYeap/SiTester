import { beforeEach, describe, expect, it } from "vitest";

import { getDashboardStats } from "@/lib/stats";
import { query } from "@/lib/db";

import { createUser, resetDb } from "./helpers";

describe("dashboard permohonan", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("permohonan kedaluwarsa tetap tampil dengan penanda", async () => {
    const tester = await createUser(undefined, "tester");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('Fitur Dash Exp',true,true) RETURNING id`,
    );
    await query(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status, created_at, expires_at)
       VALUES ($1,$2,'tester','pending', now() - interval '10 days', now() - interval '3 days')`,
      [tester.id, f[0].id],
    );

    const stats = await getDashboardStats(tester.id, false, 30, null);
    expect(stats.myTasks.myPendingRequests).toHaveLength(1);
    expect(stats.myTasks.myPendingRequests[0].expired).toBe(true);
  });
});
