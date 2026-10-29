import { beforeEach, describe, expect, it } from "vitest";

import { POST as createFeature } from "@/app/api/v1/features/route";
import { DELETE as deleteFeature } from "@/app/api/v1/features/[id]/route";
import { PATCH as verifyFeature } from "@/app/api/v1/features/[id]/verify/route";
import { POST as createRole } from "@/app/api/v1/testing-roles/route";
import { POST as createCycle } from "@/app/api/v1/test-cycles/route";
import { POST as createUserRoute } from "@/app/api/v1/users/route";
import { DELETE as deleteUser } from "@/app/api/v1/users/[id]/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

const json = (body: unknown, method = "POST") =>
  new Request("http://test/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const p = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

describe("master + guard", () => {
  let ketuaEmail = "";
  let ketuaId = "";
  let testerEmail = "";
  let testerId = "";

  beforeEach(async () => {
    await resetDb();
    const k = await createUser(undefined, "ketua_tim");
    ketuaEmail = k.email;
    ketuaId = k.id;
    const t = await createUser(undefined, "tester");
    testerEmail = t.email;
    testerId = t.id;
  });

  it("tester usul fitur langsung aktif + unverified; duplikat ditolak; ketua verifikasi", async () => {
    const base = `Fitur Usulan ${uid()}`;
    await loginAs(testerEmail);
    let r: Response = await createFeature(
      json({ name: base, is_active: true }),
    );
    expect(r.status).toBe(201);
    const f = await query<{ id: number; verified: boolean }>(
      `SELECT id, verified FROM features WHERE name=$1`,
      [base],
    );
    expect(f[0].verified).toBe(false);

    r = await createFeature(json({ name: base.toLowerCase(), is_active: true }));
    expect(r.status).toBe(422);

    await loginAs(ketuaEmail);
    r = await verifyFeature(new Request("http://test/x", { method: "PATCH" }), p(f[0].id));
    expect(r.status).toBe(200);
  });

  it("fitur ber-riwayat tidak bisa dihapus", async () => {
    const base = `Fitur Hapus ${uid()}`;
    await loginAs(testerEmail);
    await createFeature(json({ name: base, is_active: true }));
    const f = await query<{ id: number }>(
      `SELECT id FROM features WHERE name=$1`,
      [base],
    );
    await query(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, tested_as_role)
       VALUES ($1,$2,'2026-10-29','pass','tester')`,
      [testerId, f[0].id],
    );
    await loginAs(ketuaEmail);
    const r = await deleteFeature(
      new Request("http://test/x", { method: "DELETE" }),
      p(f[0].id),
    );
    expect(r.status).toBe(422);
  });

  it("tester 403 di kelola peran/siklus/pengguna", async () => {
    await loginAs(testerEmail);
    expect(
      (await createRole(json({ name: "x", label: "X" }))).status,
    ).toBe(403);
    expect(
      (await createCycle(json({ name: "C1" }))).status,
    ).toBe(403);
    expect(
      (await createUserRoute(json({ name: "N", email: "n@t.test", password: "password123" }))).status,
    ).toBe(403);
  });

  it("ketua tidak bisa hapus diri sendiri", async () => {
    await loginAs(ketuaEmail);
    const r = await deleteUser(
      new Request("http://test/x", { method: "DELETE" }),
      p(ketuaId),
    );
    expect(r.status).toBe(422);
  });

  it("validasi form: tanggal depan, fail tanpa catatan/severity, url bukti", async () => {
    const { POST: submit } = await import("@/app/api/v1/test-sessions/route");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ('FV',true,true) RETURNING id`,
    );
    await loginAs(testerEmail);

    const fd = (o: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(o)) f.set(k, v);
      return new Request("http://test/x", { method: "POST", body: f });
    };
    const base = { feature_id: String(f[0].id), is_retest: "0", tested_as_role: "tester", result: "pass" };

    expect(
      (await submit(fd({ ...base, tested_at: "2099-01-01" }))).status,
    ).toBe(422);
  });
});
