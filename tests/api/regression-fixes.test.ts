import { beforeEach, describe, expect, it } from "vitest";

import { GET as exportCsv } from "@/app/api/v1/export/csv/route";
import { GET as canTest } from "@/app/api/v1/features/[id]/can-test/route";
import { DELETE as deleteFeature } from "@/app/api/v1/features/[id]/route";
import { POST as requestRetest } from "@/app/api/v1/retest-requests/route";
import { GET as listSessions, POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { PUT as updateUser } from "@/app/api/v1/users/[id]/route";
import { addDays, todayString } from "@/lib/time";
import { safeRedirectPath } from "@/lib/validation";

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
    [name ?? `Regresi ${uid()}`],
  );
  return rows[0].id;
}

describe("regression: validasi filter riwayat", () => {
  beforeEach(async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(ketua.email);
  });

  it("filter tidak valid ditolak 422, bukan 500", async () => {
    const cases = [
      "dari=abc",
      "sampai=2026-02-30",
      "user_id=not-a-uuid",
      "feature_id=abc",
      "dari=2026-10-10&sampai=2026-10-01",
    ];

    for (const qs of cases) {
      const res = await listSessions(
        new Request(`http://test/api/v1/test-sessions?${qs}`),
      );
      expect(res.status, qs).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/tidak valid/i);
    }

    const csv = await exportCsv(new Request("http://test/api/v1/export/csv?dari=abc"));
    expect(csv.status).toBe(422);
  });

  it("tanggal mustahil ditolak dengan pesan ramah (bukan error DB)", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();

    const res = await submitSession(
      fd({
        tested_at: "2026-02-30",
        feature_id: String(fid),
        is_retest: "0",
        tested_as_role: "tester",
        result: "pass",
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("tidak valid");
    expect(body.error).not.toContain("date/time field");
  });

  it("tanggal masa depan tetap ditolak", async () => {
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();

    const res = await submitSession(
      fd({
        tested_at: addDays(todayString(), 1),
        feature_id: String(fid),
        is_retest: "0",
        tested_as_role: "tester",
        result: "pass",
      }),
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toContain(
      "masa depan",
    );
  });
});

describe("regression: CSV formula injection", () => {
  it("sel yang diawali '=' dinetralkan", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await featureId();
    await query(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, notes, tested_as_role)
       VALUES ($1,$2,CURRENT_DATE,'pass',$3,'tester')`,
      [ketua.id, fid, '=HYPERLINK("http://evil.test")'],
    );
    await loginAs(ketua.email);

    const res = await exportCsv(new Request("http://test/api/v1/export/csv"));
    const body = await res.text();
    expect(body).toContain(`"'=HYPERLINK`);
    expect(body).not.toContain(`"=HYPERLINK`);
  });
});

describe("regression: permohonan retest harus relevan", () => {
  it("fitur belum diuji atau belum Pass tidak boleh dimohonkan", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();

    let res = await requestRetest(
      json({ feature_id: fid, tested_as_role: "tester" }),
    );
    expect(res.status).toBe(422);

    await query(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, tested_as_role)
       VALUES ($1,$2,CURRENT_DATE,'fail','tester')`,
      [tester.id, fid],
    );
    res = await requestRetest(json({ feature_id: fid, tested_as_role: "tester" }));
    expect(res.status).toBe(422);
  });

  it("fitur Pass boleh dimohonkan dan mengembalikan id", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();
    await query(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, tested_as_role)
       VALUES ($1,$2,CURRENT_DATE,'pass','tester')`,
      [tester.id, fid],
    );

    const res = await requestRetest(
      json({ feature_id: fid, tested_as_role: "tester" }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number };
    expect(Number.isInteger(body.id)).toBe(true);

    const dup = await requestRetest(
      json({ feature_id: fid, tested_as_role: "tester" }),
    );
    expect(dup.status).toBe(422);
  });
});

describe("regression: ID path tidak valid", () => {
  it("ID non-numerik menghasilkan 404, bukan error DB", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(ketua.email);

    const canTestRes = await canTest(
      new Request("http://test/api/v1/features/abc/can-test"),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(canTestRes.status).toBe(404);

    const deleteRes = await deleteFeature(
      new Request("http://test/api/v1/features/abc", { method: "DELETE" }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(deleteRes.status).toBe(404);
  });
});

describe("regression: keamanan akun", () => {
  it("ganti password mencabut semua sesi pengguna", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(tester.email);

    await loginAs(ketua.email);
    const res = await updateUser(
      new Request("http://test/x", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password-baru-123" }),
      }),
      { params: Promise.resolve({ id: tester.id }) },
    );
    expect(res.status).toBe(200);

    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sessions WHERE user_id=$1`,
      [tester.id],
    );
    expect(rows[0].n).toBe("0");
  });

  it("redirect setelah login hanya boleh path internal", () => {
    expect(safeRedirectPath("//evil.test")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.test")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.test")).toBe("/dashboard");
    expect(safeRedirectPath("/riwayat?x=1")).toBe("/riwayat?x=1");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});

describe("regression: pending retest per peran", () => {
  it("pending peran lain tidak dihitung untuk peran ini", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();
    await query(
      `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status)
       VALUES ($1,$2,'tester','pending')`,
      [tester.id, fid],
    );

    const own = await canTest(
      new Request(`http://test/api/v1/features/${fid}/can-test?role=tester`),
      { params: Promise.resolve({ id: String(fid) }) },
    );
    expect(((await own.json()) as { hasPendingRequest: boolean }).hasPendingRequest).toBe(true);

    const other = await canTest(
      new Request(`http://test/api/v1/features/${fid}/can-test?role=super_admin`),
      { params: Promise.resolve({ id: String(fid) }) },
    );
    expect(((await other.json()) as { hasPendingRequest: boolean }).hasPendingRequest).toBe(false);
  });
});
