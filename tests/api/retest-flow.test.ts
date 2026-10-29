import { beforeEach, describe, expect, it } from "vitest";

import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { PATCH as approve } from "@/app/api/v1/retest-requests/[id]/approve/route";
import { POST as requestRetest } from "@/app/api/v1/retest-requests/route";
import { GET as canTest } from "@/app/api/v1/features/[id]/can-test/route";

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
    [name ?? `Fitur Audit ${uid()}`],
  );
  return rows[0].id;
}

describe("alur retest", () => {
  let ketuaEmail = "";
  let testerEmail = "";
  let tester2Email = "";

  beforeEach(async () => {
    await resetDb();
    ketuaEmail = (await createUser(undefined, "ketua_tim")).email;
    testerEmail = (await createUser(undefined, "tester")).email;
    tester2Email = (await createUser(undefined, "tester")).email;
  });

  it("Pass -> blokir non-retest -> ajukan -> setujui -> retest lolos + approval terpakai", async () => {
    const fid = await featureId();
    await loginAs(testerEmail);

    let r: Response = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(201);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(422);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(422);

    r = await requestRetest(json({ feature_id: fid, tested_as_role: "tester" }));
    expect(r.status).toBe(201);

    r = await requestRetest(json({ feature_id: fid, tested_as_role: "tester" }));
    expect(r.status).toBe(422);

    const req = await query<{ id: number }>(
      `SELECT id FROM retest_requests ORDER BY id DESC LIMIT 1`,
    );
    await loginAs(ketuaEmail);
    const ap = await approve(new Request("http://test/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: String(req[0].id) }),
    });
    expect(ap.status).toBe(200);

    await loginAs(testerEmail);
    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(201);

    const used = await query<{ used: boolean }>(
      `SELECT used_at IS NOT NULL AS used FROM retest_approvals ORDER BY id DESC LIMIT 1`,
    );
    expect(used[0].used).toBe(true);
  });

  it("Fail langsung boleh retest tanpa approval", async () => {
    const fid = await featureId();
    await loginAs(testerEmail);

    let r: Response = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", result: "fail", notes: "catatan cukup panjang di sini", severity: "high" }),
    );
    expect(r.status).toBe(201);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "1", tested_as_role: "tester", result: "pass" }),
    );
    expect(r.status).toBe(201);
  });

  it("peran beda tidak saling blokir; siklus baru fresh", async () => {
    const fid = await featureId();
    await query(
      `INSERT INTO test_cycles (name, is_active) VALUES ('R1',true),('R2',true) ON CONFLICT (name) DO NOTHING`,
    );
    await loginAs(testerEmail);

    let r: Response = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "super_admin", test_cycle: "R1", result: "pass" }),
    );
    expect(r.status).toBe(201);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "admin_instansi", test_cycle: "R1", result: "pass" }),
    );
    expect(r.status).toBe(201);

    r = await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "super_admin", test_cycle: "R2", result: "pass" }),
    );
    expect(r.status).toBe(201);
  });

  it("can-test memberi warning non-blokir untuk tester lain <24 jam", async () => {
    const fid = await featureId("Fitur W");
    await loginAs(testerEmail);
    await submitSession(
      fd({ tested_at: "2026-10-29", feature_id: String(fid), is_retest: "0", tested_as_role: "tester", result: "fail", notes: "catatan cukup panjang sekali", severity: "low" }),
    );

    
    await loginAs(tester2Email);
    const res = await canTest(
      new Request(`http://test/api/v1/features/${fid}/can-test?is_retest=0&role=tester`),
      { params: Promise.resolve({ id: String(fid) }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { allowed: boolean; duplicateWarning: string | null };
    expect(data.allowed).toBe(true);
    expect(data.duplicateWarning).toBeTruthy();
  });
});
