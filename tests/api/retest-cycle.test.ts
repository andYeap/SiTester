import { beforeEach, describe, expect, it } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { PATCH as approve } from "@/app/api/v1/retest-requests/[id]/approve/route";
import { POST as requestRetest } from "@/app/api/v1/retest-requests/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return new Request("http://test/api/v1/test-sessions", { method: "POST", body: f });
}

const json = (body: unknown) =>
  new Request("http://test/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function featureId(name?: string) {
  const rows = await query<{ id: number }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
    [name ?? `Fitur Siklus ${uid()}`],
  );
  return rows[0].id;
}

describe("retest scope siklus", () => {
  let ketuaEmail = "";
  let testerEmail = "";

  beforeEach(async () => {
    await resetDb();
    ketuaEmail = (await createUser(undefined, "ketua_tim")).email;
    testerEmail = (await createUser(undefined, "tester")).email;
    await query(
      `INSERT INTO test_cycles (name, is_active) VALUES ('SA',true),('SB',true) ON CONFLICT (name) DO NOTHING`,
    );
  });

  it("approval Siklus SA tidak berlaku di Siklus SB", async () => {
    const fid = await featureId();
    await loginAs(testerEmail);

    let r: Response = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", test_cycle: "SA", result: "pass" }),
    );
    expect(r.status).toBe(201);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", test_cycle: "SB", result: "pass" }),
    );
    expect(r.status).toBe(201);

    // Minta retest untuk SA saja
    r = await requestRetest(json({ feature_id: fid, tested_as_role: "tester", test_cycle: "SA" }));
    expect(r.status).toBe(201);
    const created = (await r.json()) as { id: number };

    await loginAs(ketuaEmail);
    const ap = await approve(new Request("http://test/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: String(created.id) }),
    });
    expect(ap.status).toBe(200);

    await loginAs(testerEmail);
    // BUG bila approval SA bisa dipakai di SB: ini harus 422, bukan 201.
    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", test_cycle: "SB", result: "pass" }),
    );
    expect(r.status).toBe(422);

    // Retest di SA lolos
    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", test_cycle: "SA", result: "pass" }),
    );
    expect(r.status).toBe(201);
  });
});
