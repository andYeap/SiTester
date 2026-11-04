import { describe, expect, it } from "vitest";

import { GET as listBatches } from "@/app/api/v1/import/batches/route";
import { POST as commitImport } from "@/app/api/v1/import/commit/route";
import { POST as errorsCsv } from "@/app/api/v1/import/errors/route";
import { POST as previewImport } from "@/app/api/v1/import/preview/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

const HEADER =
  "Tanggal,Email Tester,Fitur,Hasil,Peran,Siklus,Test Case,Severity,Lingkungan,Diharapkan,Terjadi,Catatan,Bukti URL,Ulang";

async function featureId(name?: string) {
  const rows = await query<{ id: number; name: string }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id, name`,
    [name ?? `ImportV2 ${uid()}`],
  );
  return rows[0];
}

function importRequest(
  csv: string,
  options: {
    filename?: string;
    headerRow?: number;
    mapping?: Record<string, string>;
    skipInvalid?: boolean;
    sheet?: string;
  } = {},
) {
  const form = new FormData();
  form.set(
    "file",
    new File([csv], options.filename ?? "import.csv", {
      type: options.filename?.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv",
    }),
  );
  if (options.headerRow) form.set("header_row", String(options.headerRow));
  if (options.mapping) form.set("mapping", JSON.stringify(options.mapping));
  if (options.skipInvalid) form.set("skip_invalid", "1");
  if (options.sheet) form.set("sheet", options.sheet);
  return new Request("http://test/api/v1/import", { method: "POST", body: form });
}

async function ketuaLogin() {
  const ketua = await createUser(undefined, "ketua_tim");
  await loginAs(ketua.email);
  return ketua;
}

describe("import v2", () => {
  it("skip baris error, commit valid, lalu dedupe import ulang", async () => {
    await resetDb();
    const ketua = await ketuaLogin();
    const tester = await createUser(undefined, "tester");
    const f = await featureId();

    const csv = [
      HEADER,
      `2026-10-29,${tester.email},${f.name},Pass,tester,,,,,,,,,0`,
      `2026-10-29,${tester.email},Fitur Tidak Ada,Pass,tester,,,,,,,,,0`,
    ].join("\n");

    const preview = await previewImport(
      importRequest(csv) as unknown as Request,
    );
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as {
      summary: { valid: number; invalid: number };
    };
    expect(previewBody.summary).toEqual({ total: 2, valid: 1, invalid: 1 });

    const blocked = await commitImport(importRequest(csv) as unknown as Request);
    expect(blocked.status).toBe(422);

    const first = await commitImport(
      importRequest(csv, { skipInvalid: true }) as unknown as Request,
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as {
      imported: number;
      skipped: number;
      invalid: number;
      batchId: number;
    };
    expect(firstBody.imported).toBe(1);
    expect(firstBody.skipped).toBe(0);
    expect(firstBody.invalid).toBe(1);

    const second = await commitImport(
      importRequest(csv, { skipInvalid: true }) as unknown as Request,
    );
    expect(second.status).toBe(201);
    const secondBody = (await second.json()) as {
      imported: number;
      skipped: number;
    };
    expect(secondBody.imported).toBe(0);
    expect(secondBody.skipped).toBe(1);

    const sessions = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions WHERE feature_id=$1`,
      [f.id],
    );
    expect(sessions[0].n).toBe("1");

    const batches = await listBatches();
    expect(batches.status).toBe(200);
    const batchesBody = (await batches.json()) as {
      batches: { id: number; user_name: string; imported: number }[];
    };
    const ownBatch = batchesBody.batches.find((b) => b.id === firstBody.batchId);
    const ketuaRow = await query<{ name: string }>(
      `SELECT name FROM users WHERE id=$1`,
      [ketua.id],
    );
    expect(ownBatch?.user_name).toBe(ketuaRow[0].name);
  });

  it("kolom test case/expected/actual/bukti masuk; defect milik tester & bertanggal pengujian", async () => {
    await resetDb();
    await ketuaLogin();
    const tester = await createUser(undefined, "tester");
    const f = await featureId();

    await query(
      `INSERT INTO test_cases (feature_id, title, created_by) VALUES ($1,$2,$3)`,
      [f.id, "Login valid", tester.id],
    );

    const csv = [
      HEADER,
      `2026-10-29,${tester.email},${f.name},Fail,tester,,Login valid,high,Chrome,Masuk dashboard,Error 500,Bug tidak konsisten saat login,https://example.test/bukti.png,0`,
    ].join("\n");

    const res = await commitImport(importRequest(csv) as unknown as Request);
    expect(res.status).toBe(201);

    const session = await query<{
      test_case_id: number;
      expected: string;
      actual: string;
      evidence_url: string;
      notes: string;
    }>(
      `SELECT test_case_id, expected, actual, evidence_url, notes
         FROM test_sessions WHERE feature_id=$1`,
      [f.id],
    );
    expect(session[0].expected).toBe("Masuk dashboard");
    expect(session[0].actual).toBe("Error 500");
    expect(session[0].evidence_url).toBe("https://example.test/bukti.png");
    expect(session[0].test_case_id).toBeTruthy();

    const defect = await query<{
      created_by: string;
      created_at_date: string;
      title: string;
    }>(
      `SELECT created_by, created_at::date::text AS created_at_date, title
         FROM defects WHERE feature_id=$1`,
      [f.id],
    );
    expect(defect[0].created_by).toBe(tester.id);
    expect(defect[0].created_at_date).toBe("2026-10-29");
    expect(defect[0].title).toContain("Login valid");
  });

  it("fitur di luar lingkup siklus ditolak", async () => {
    await resetDb();
    await ketuaLogin();
    const tester = await createUser(undefined, "tester");
    const inside = await featureId();
    const outside = await featureId();
    const cycle = `CY-${uid()}`;
    const cycleRow = await query<{ id: number }>(
      `INSERT INTO test_cycles (name, is_active) VALUES ($1,true) RETURNING id`,
      [cycle],
    );
    await query(
      `INSERT INTO cycle_features (cycle_id, feature_id) VALUES ($1,$2)`,
      [cycleRow[0].id, inside.id],
    );

    const csv = [
      HEADER,
      `2026-10-29,${tester.email},${outside.name},Pass,tester,${cycle},,,,,,,,0`,
    ].join("\n");

    const res = await previewImport(importRequest(csv) as unknown as Request);
    const body = (await res.json()) as {
      summary: { invalid: number };
      rows: { errors: string[] }[];
    };
    expect(body.summary.invalid).toBe(1);
    expect(body.rows[0].errors.join(" ")).toContain("lingkup siklus");
  });

  it("mapping kolom kustom dan baris header bukan pertama", async () => {
    await resetDb();
    await ketuaLogin();
    const tester = await createUser(undefined, "tester");
    const f = await featureId();

    const csv = [
      "Laporan pengujian",
      "Waktu,Email,Nama Fitur,Status",
      `2026-10-29,${tester.email},${f.name},Pass`,
    ].join("\n");

    const res = await previewImport(
      importRequest(csv, {
        headerRow: 2,
        mapping: {
          tested_at: "Waktu",
          email: "Email",
          feature: "Nama Fitur",
          result: "Status",
        },
      }) as unknown as Request,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      summary: { valid: number; invalid: number };
    };
    expect(body.summary.valid).toBe(1);
    expect(body.summary.invalid).toBe(0);
  });

  it("memilih sheet Excel dan mengunduh CSV error", async () => {
    await resetDb();
    await ketuaLogin();
    const tester = await createUser(undefined, "tester");
    const f = await featureId();

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Catatan").addRow(["abaikan"]);
    const ws = wb.addWorksheet("Data");
    ws.addRow(HEADER.split(","));
    ws.addRow([
      "2026-10-29",
      tester.email,
      f.name,
      "Pass",
      "tester",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "0",
    ]);
    ws.addRow([
      "2026-99-99",
      tester.email,
      f.name,
      "Pass",
      "tester",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "0",
    ]);
    const buffer = await wb.xlsx.writeBuffer();

    const makeForm = () => {
      const form = new FormData();
      form.set(
        "file",
        new File([buffer], "import.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      form.set("sheet", "Data");
      return new Request("http://test/api/v1/import", {
        method: "POST",
        body: form,
      });
    };

    const preview = await previewImport(makeForm());
    expect(preview.status).toBe(200);
    const body = (await preview.json()) as {
      summary: { valid: number; invalid: number };
      sheet: string;
    };
    expect(body.sheet).toBe("Data");
    expect(body.summary.valid).toBe(1);
    expect(body.summary.invalid).toBe(1);

    const errors = await errorsCsv(makeForm());
    expect(errors.status).toBe(200);
    const csv = await errors.text();
    expect(csv).toContain("2026-99-99");
    expect(csv.toLowerCase()).toContain("tanggal");
  });

  it("file xlsx rusak di route errors mengembalikan 422", async () => {
    await ketuaLogin();
    const res = await errorsCsv(
      importRequest("bukan xlsx", { filename: "rusak.xlsx" }),
    );
    expect(res.status).toBe(422);
  });
});
