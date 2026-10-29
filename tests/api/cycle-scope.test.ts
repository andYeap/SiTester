import { beforeEach, describe, expect, it } from "vitest";

import { GET as canTest } from "@/app/api/v1/features/[id]/can-test/route";
import { GET as dashboard } from "@/app/api/v1/dashboard/stats/route";
import { POST as createCycle } from "@/app/api/v1/test-cycles/route";
import { POST as submit } from "@/app/api/v1/test-sessions/route";
import { query } from "@/lib/db";

import { createUser, loginAs, resetDb, uid } from "./helpers";

const json = (body: unknown) =>
  new Request("http://test/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const fd = (obj: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return new Request("http://test/x", { method: "POST", body: f });
};

describe("lingkup siklus", () => {
  let fidA = 0;
  let fidB = 0;
  let tester = "";
  let ketua = "";
  let tag = "";

  beforeEach(async () => {
    await resetDb();
    const k = await createUser(undefined, "ketua_tim");
    ketua = k.email;
    const t = await createUser(undefined, "tester");
    tester = t.email;
    tag = uid();
    const a = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Fitur Scope A ${tag}`],
    );
    const b = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`Fitur Scope B ${tag}`],
    );
    fidA = a[0].id;
    fidB = b[0].id;
    await loginAs(tester);
  });

  async function buatSiklus(base: string, scope: number[]): Promise<string> {
    await loginAs(ketua);
    const name = `${base}-${tag}`;
    const r = await createCycle(
      json({ name, description: "d", is_active: true, feature_ids: scope, brief: "Fokus: login dan checkout." }),
    );
    expect(r.status).toBe(201);
    await loginAs(tester);
    return name;
  }

  it("brief tersimpan dan terbaca", async () => {
    const name = await buatSiklus("R-Brief", [fidA]);
    const rows = await query<{ brief: string | null }>(
      `SELECT brief FROM test_cycles WHERE name=$1`,
      [name],
    );
    expect(rows[0].brief).toBe("Fokus: login dan checkout.");
  });

  it("di luar lingkup ditolak, di dalam lolos", async () => {
    const name = await buatSiklus("R-Scope", [fidA]);
    const base = { tested_at: "2026-10-29", is_retest: "0", tested_as_role: "tester", test_cycle: name, result: "pass" };

    const tolak = await submit(fd({ ...base, feature_id: String(fidB) }));
    expect(tolak.status).toBe(422);
    expect(((await tolak.json()) as { error?: string }).error ?? "").toContain(name);

    const ok = await submit(fd({ ...base, feature_id: String(fidA) }));
    expect(ok.status).toBe(201);
  });

  it("tanpa lingkup: semua fitur boleh (kompatibel lama)", async () => {
    await loginAs(ketua);
    const name = `${"R-Bebas"}-${tag}`;
    const r = await createCycle(json({ name, feature_ids: [] }));
    expect(r.status).toBe(201);
    await loginAs(tester);

    const ok = await submit(
      fd({ tested_at: "2026-10-29", feature_id: String(fidB), is_retest: "0", tested_as_role: "tester", test_cycle: name, result: "pass" }),
    );
    expect(ok.status).toBe(201);
  });

  it("dashboard: brief + cakupan X dari Y + daftar belum diuji", async () => {
    const name = await buatSiklus("R-Dash", [fidA, fidB]);
    await submit(
      fd({ tested_at: "2026-10-29", feature_id: String(fidA), is_retest: "0", tested_as_role: "tester", test_cycle: name, result: "pass" }),
    );

    const res = await dashboard(new Request(`http://test/x?range=30&cycle=${encodeURIComponent(name)}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      brief: string | null;
      scope: { total: number; tested: number; untested: string[] } | null;
    };
    expect(data.brief).toBe("Fokus: login dan checkout.");
    expect(data.scope).toMatchObject({ total: 2, tested: 1 });
    expect(data.scope?.untested).toHaveLength(1);
    expect(data.scope?.untested[0]).toContain("Fitur Scope B");
  });

  it("can-test ikut lingkup", async () => {
    const name = await buatSiklus("R-Cek", [fidA]);
    const res = await canTest(
      new Request(`http://test/x?is_retest=0&role=tester&cycle=${encodeURIComponent(name)}`),
      { params: Promise.resolve({ id: String(fidB) }) },
    );
    expect(res.status).toBe(200);
  });
});
