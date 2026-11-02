import { describe, expect, it } from "vitest";

import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { GET as health } from "@/app/api/health/route";
import { PATCH as updateDefect } from "@/app/api/v1/defects/[id]/route";
import { POST as createCase } from "@/app/api/v1/features/[id]/test-cases/route";
import { POST as commitImport } from "@/app/api/v1/import/commit/route";
import { POST as previewImport } from "@/app/api/v1/import/preview/route";
import { GET as listSessions, POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { createResetToken } from "@/lib/reset";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return new Request("http://test/api/v1/test-sessions", { method: "POST", body: f });
}

async function featureId(name?: string) {
  const rows = await query<{ id: number }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
    [name ?? `V3 ${uid()}`],
  );
  return rows[0].id;
}

async function importFile(csv: string) {
  const form = new FormData();
  form.set("file", new File([csv], "import.csv", { type: "text/csv" }));
  return new Request("http://test/api/v1/import", { method: "POST", body: form });
}

const HEADER =
  "Tanggal,Email Tester,Peran,Siklus,Fitur,Hasil,Severity,Lingkungan,Catatan,Ulang";

describe("v3: reset password", () => {
  it("token sekali pakai, ganti password, dan cabut sesi lama", async () => {
    await resetDb();
    const user = await createUser(undefined, "tester");
    await loginAs(user.email); // buat sesi lama

    const forgotRes = await forgot(
      new Request("http://test/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      }),
    );
    expect(forgotRes.status).toBe(200);
    // Token dibuat langsung agar tidak bergantung pada konfigurasi SMTP/NODE_ENV.
    const token = await createResetToken(user.id);

    const resetRes = await reset(
      new Request("http://test/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "password-baru-123" }),
      }),
    );
    expect(resetRes.status).toBe(200);

    const sessions = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sessions WHERE user_id=$1`,
      [user.id],
    );
    expect(sessions[0].n).toBe("0");

    const reuse = await reset(
      new Request("http://test/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "password-lain-123" }),
      }),
    );
    expect(reuse.status).toBe(422);

    const loginRes = await login(
      new Request("http://test/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: "password-baru-123",
        }),
      }),
    );
    expect(loginRes.status).toBe(200);
  });
});

describe("v3: import", () => {
  it("pratinjau menandai error dan commit menolak seluruh file", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const tester = await createUser(undefined, "tester");
    const fid = await featureId("Fitur Import");
    const featureName = (
      await query<{ name: string }>(`SELECT name FROM features WHERE id=$1`, [fid])
    )[0].name;

    const badCsv = [
      HEADER,
      `2026-10-29,${tester.email},tester,,${featureName},Pass,,,,0`,
      `2026-13-40,${tester.email},tester,,${featureName},Bug,high,,terlalu pendek,0`,
    ].join("\n");

    await loginAs(ketua.email);
    const previewRes = await previewImport(await importFile(badCsv));
    expect(previewRes.status).toBe(200);
    const preview = (await previewRes.json()) as {
      summary: { total: number; invalid: number };
    };
    expect(preview.summary.invalid).toBeGreaterThan(0);

    const commitRes = await commitImport(await importFile(badCsv));
    expect(commitRes.status).toBe(422);

    const count = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1`,
      [fid],
    );
    expect(count[0].n).toBe("0");
  });

  it("commit valid menyimpan baris", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const tester = await createUser(undefined, "tester");
    const fid = await featureId();
    const featureName = (
      await query<{ name: string }>(`SELECT name FROM features WHERE id=$1`, [fid])
    )[0].name;

    const csv = [
      HEADER,
      `2026-10-29,${tester.email},tester,,${featureName},Pass,,,,0`,
    ].join("\n");

    await loginAs(ketua.email);
    // Template CSV memakai BOM UTF-8; parser harus tetap mengenali header.
    const res = await commitImport(await importFile(`\uFEFF${csv}`));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(1);

    const rows = await query<{ result: string }>(
      `SELECT result FROM test_sessions WHERE feature_id=$1`,
      [fid],
    );
    expect(rows[0].result).toBe("pass");
  });

  it("membaca file .xlsx", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const tester = await createUser(undefined, "tester");
    const fid = await featureId();
    const featureName = (
      await query<{ name: string }>(`SELECT name FROM features WHERE id=$1`, [fid])
    )[0].name;

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data");
    ws.addRow(HEADER.split(","));
    ws.addRow([
      "2026-10-29",
      tester.email,
      "tester",
      "",
      featureName,
      "Pass",
      "",
      "",
      "",
      "0",
    ]);
    const buffer = await wb.xlsx.writeBuffer();

    const form = new FormData();
    form.set(
      "file",
      new File([buffer], "import.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    await loginAs(ketua.email);
    const res = await previewImport(
      new Request("http://test/api/v1/import/preview", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      summary: { valid: number; invalid: number };
    };
    expect(body.summary.valid).toBe(1);
    expect(body.summary.invalid).toBe(0);
  });
});

describe("v3: test case dan defect", () => {
  it("test case harus milik fitur; Fail membuat defect open", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();

    const caseRes = await createCase(
      new Request("http://test/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Login valid" }),
      }),
      { params: Promise.resolve({ id: String(fid) }) },
    );
    expect(caseRes.status).toBe(201);
    const caseId = ((await caseRes.json()) as { id: number }).id;

    const otherFid = await featureId();
    const bad = await submitSession(
      fd({
        tested_at: "2026-10-29",
        feature_id: String(otherFid),
        test_case_id: String(caseId),
        is_retest: "0",
        tested_as_role: "tester",
        result: "pass",
      }),
    );
    expect(bad.status).toBe(422);

    const ok = await submitSession(
      fd({
        tested_at: "2026-10-29",
        feature_id: String(fid),
        test_case_id: String(caseId),
        is_retest: "0",
        tested_as_role: "tester",
        result: "fail",
        severity: "high",
        notes: "Gagal login dengan kredensial valid",
      }),
    );
    expect(ok.status).toBe(201);
    const okBody = (await ok.json()) as { defectId: number };
    expect(okBody.defectId).toBeGreaterThan(0);

    const session = await query<{ test_case_id: number }>(
      `SELECT test_case_id FROM test_sessions WHERE feature_id=$1`,
      [fid],
    );
    expect(Number(session[0].test_case_id)).toBe(caseId);

    const defect = await query<{ status: string }>(
      `SELECT status FROM defects WHERE id=$1`,
      [okBody.defectId],
    );
    expect(defect[0].status).toBe("open");

    const fix = await updateDefect(
      new Request("http://test/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "fixed" }),
      }),
      { params: Promise.resolve({ id: String(okBody.defectId) }) },
    );
    expect(fix.status).toBe(200);

    const verifyAsTester = await updateDefect(
      new Request("http://test/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "verified" }),
      }),
      { params: Promise.resolve({ id: String(okBody.defectId) }) },
    );
    expect(verifyAsTester.status).toBe(403);

    const ketua = await createUser(undefined, "ketua_tim");
    await loginAs(ketua.email);
    const verify = await updateDefect(
      new Request("http://test/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "verified" }),
      }),
      { params: Promise.resolve({ id: String(okBody.defectId) }) },
    );
    expect(verify.status).toBe(200);
  });
});

describe("v3: riwayat sort, upload, health", () => {
  it("sort tanggal naik/turun", async () => {
    await resetDb();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await featureId();
    await query(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result, tested_as_role)
       VALUES ($1,$2,'2026-10-01','pass','tester'),($1,$2,'2026-10-05','pass','tester')`,
      [ketua.id, fid],
    );
    await loginAs(ketua.email);

    const asc = await listSessions(
      new Request(
        `http://test/api/v1/test-sessions?sort=date_asc&feature_id=${fid}`,
      ),
    );
    const ascBody = (await asc.json()) as { sessions: { tested_at: string }[] };
    expect(ascBody.sessions[0].tested_at).toBe("2026-10-01");

    const desc = await listSessions(
      new Request(
        `http://test/api/v1/test-sessions?sort=date_desc&feature_id=${fid}`,
      ),
    );
    const descBody = (await desc.json()) as { sessions: { tested_at: string }[] };
    expect(descBody.sessions[0].tested_at).toBe("2026-10-05");
  });

  it("file non-gambar ditolak walau MIME dipalsukan", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    await loginAs(tester.email);
    const fid = await featureId();
    const form = new FormData();
    form.set("tested_at", "2026-10-29");
    form.set("feature_id", String(fid));
    form.set("is_retest", "0");
    form.set("tested_as_role", "tester");
    form.set("result", "pass");
    form.set(
      "evidence",
      new File(["bukan gambar"], "palsu.png", { type: "image/png" }),
    );
    const res = await submitSession(
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("health check", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("rate limit per IP", async () => {
    await resetDb();
    const ip = `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 30; i++) {
      await login(
        new Request("http://test/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            email: `fiktif-${uid()}@t.test`,
            password: "salah",
          }),
        }),
      );
    }
    const user = await createUser(undefined, "tester");
    const blocked = await login(
      new Request("http://test/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ email: user.email, password: "password123" }),
      }),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
