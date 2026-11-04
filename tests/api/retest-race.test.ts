import { beforeEach, describe, expect, it } from "vitest";

import { PATCH as approve } from "@/app/api/v1/retest-requests/[id]/approve/route";
import { PATCH as reject } from "@/app/api/v1/retest-requests/[id]/reject/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb } from "./helpers";

describe("balapan approve/reject permohonan", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("approve dan reject bersamaan hanya menghasilkan satu keputusan", async () => {
    const ketua = await createUser(undefined, "ketua_tim");
    const tester = await createUser(undefined, "tester");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('Fitur Race Req',true,true) RETURNING id`,
    );
    const req = await query<{ id: number }>(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status)
       VALUES ($1,$2,'tester','pending') RETURNING id`,
      [tester.id, f[0].id],
    );
    await loginAs(ketua.email);

    const params = { params: Promise.resolve({ id: String(req[0].id) }) };
    const rejectRequest = new Request("http://test/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: "tidak perlu" }),
    });

    const results = await Promise.all([
      approve(new Request("http://test/x", { method: "PATCH" }), params),
      reject(rejectRequest, params),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);

    const rows = await query<{ status: string }>(
      `SELECT status FROM retest_requests WHERE id=$1`,
      [req[0].id],
    );
    expect(["approved", "rejected"]).toContain(rows[0].status);
    expect(rows[0].status).not.toBe("pending");
  });
});
