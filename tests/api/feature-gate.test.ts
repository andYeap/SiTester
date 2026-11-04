import { describe, expect, it } from "vitest";

import { POST as createFeature } from "@/app/api/v1/features/route";
import { PATCH as verifyFeature } from "@/app/api/v1/features/[id]/verify/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

const json = (body: unknown) =>
  new Request("http://test/api/v1/features", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("gate usulan fitur tester", () => {
  it("usulan tester nonaktif sampai ketua verifikasi", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const ketua = await createUser(undefined, "ketua_tim");
    const name = `Usulan ${uid()}`;

    await loginAs(tester.email);
    const res = await createFeature(json({ name }));
    expect(res.status).toBe(201);

    let row = await query<{ is_active: boolean; verified: boolean }>(
      `SELECT is_active, verified FROM features WHERE name=$1`,
      [name],
    );
    expect(row[0].is_active).toBe(false);
    expect(row[0].verified).toBe(false);

    const fid = await query<{ id: number }>(
      `SELECT id FROM features WHERE name=$1`,
      [name],
    );
    await loginAs(ketua.email);
    const v = await verifyFeature(new Request("http://test/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: String(fid[0].id) }),
    });
    expect(v.status).toBe(200);

    row = await query<{ is_active: boolean; verified: boolean }>(
      `SELECT is_active, verified FROM features WHERE name=$1`,
      [name],
    );
    expect(row[0].verified).toBe(true);
    expect(row[0].is_active).toBe(true);
  });

  it("fitur ketua langsung aktif", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const name = `Ketua ${uid()}`;
    await loginAs(ketua.email);
    const res = await createFeature(json({ name }));
    expect(res.status).toBe(201);
    const row = await query<{ is_active: boolean; verified: boolean }>(
      `SELECT is_active, verified FROM features WHERE name=$1`,
      [name],
    );
    expect(row[0].is_active).toBe(true);
    expect(row[0].verified).toBe(true);
  });
});
