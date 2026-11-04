import { beforeEach, describe, expect, it } from "vitest";

import { PATCH as updateDefect } from "@/app/api/v1/defects/[id]/route";

import { createUser, loginAs, resetDb } from "./helpers";
import { query } from "@/lib/db";

function patch(id: number, status: string) {
  return updateDefect(
    new Request("http://test/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );
}

describe("defect transition", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("open→closed dan fixed→closed ditolak; hanya verified→closed", async () => {
    const tester = await createUser(undefined, "tester");
    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(tester.email);
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('F-defect',true,true) RETURNING id`,
    );
    const d1 = await query<{ id: number }>(
      `INSERT INTO defects (feature_id, title, status, created_by) VALUES ($1,'D1','open',$2) RETURNING id`,
      [f[0].id, tester.id],
    );
    // open -> closed harus 422
    let r = await patch(d1[0].id, "closed");
    expect(r.status).toBe(422);

    // open -> fixed ok
    r = await patch(d1[0].id, "fixed");
    expect(r.status).toBe(200);

    // fixed -> closed harus 422
    r = await patch(d1[0].id, "closed");
    expect(r.status).toBe(422);

    // fixed -> verified oleh tester ditolak 403, oleh ketua ok
    r = await patch(d1[0].id, "verified");
    expect(r.status).toBe(403);
    await loginAs(ketua.email);
    r = await patch(d1[0].id, "verified");
    expect(r.status).toBe(200);

    // verified -> closed ok
    r = await patch(d1[0].id, "closed");
    expect(r.status).toBe(200);
  });
});
