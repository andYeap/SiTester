import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { query } from "@/lib/db";
import { todayString } from "@/lib/time";
import { isIsoDate } from "@/lib/validation";

export type ImportResult = "pass" | "fail" | "bug";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024; // aman commit ≤60s + body Vercel ±4.5MB
export const IMPORT_MAX_ROWS = 5_000;
export const IMPORT_PREVIEW_ROWS = 500;

export type ImportField =
  | "tested_at"
  | "email"
  | "role"
  | "cycle"
  | "feature"
  | "test_case"
  | "result"
  | "severity"
  | "environment"
  | "expected"
  | "actual"
  | "notes"
  | "evidence_url"
  | "is_retest";

export const IMPORT_FIELDS: {
  key: ImportField;
  label: string;
  required: boolean;
}[] = [
  { key: "tested_at", label: "Tanggal", required: true },
  { key: "email", label: "Email Tester", required: true },
  { key: "feature", label: "Fitur", required: true },
  { key: "result", label: "Hasil", required: true },
  { key: "role", label: "Peran", required: false },
  { key: "cycle", label: "Siklus", required: false },
  { key: "test_case", label: "Test Case", required: false },
  { key: "severity", label: "Severity", required: false },
  { key: "environment", label: "Lingkungan", required: false },
  { key: "expected", label: "Diharapkan", required: false },
  { key: "actual", label: "Terjadi", required: false },
  { key: "notes", label: "Catatan", required: false },
  { key: "evidence_url", label: "Bukti URL", required: false },
  { key: "is_retest", label: "Ulang", required: false },
];

export type ImportMapping = Partial<Record<ImportField, string>>;

export type ParsedImportRow = {
  row: number;
  testedAt: string;
  testedAtRaw: string;
  email: string;
  featureName: string;
  role: string;
  cycle: string | null;
  testCaseTitle: string | null;
  result: ImportResult;
  severity: string | null;
  environment: string | null;
  expected: string | null;
  actual: string | null;
  notes: string | null;
  evidenceUrl: string | null;
  isRetest: boolean;
  errors: string[];
  userId?: string;
  featureId?: number;
  testCaseId?: number | null;
  rowHash?: string;
};

export type ImportParseResult = {
  rows: ParsedImportRow[];
  total: number;
  valid: number;
  invalid: number;
  headers: string[];
  sheets: string[];
  sheet: string;
  headerRow: number;
  mapping: Record<ImportField, string | null>;
  headerErrors: string[];
  fileHash: string;
};

const HEADER_ALIASES: Record<ImportField, string[]> = {
  tested_at: ["tanggal", "tanggal pengujian", "date", "tested at"],
  email: ["email", "email tester", "tester", "email penguji"],
  role: ["peran", "peran uji", "role", "tested as role"],
  cycle: ["siklus", "cycle", "test cycle"],
  feature: ["fitur", "feature", "nama fitur"],
  test_case: ["test case", "testcase", "test_case", "skenario", "case"],
  result: ["hasil", "result", "status hasil"],
  severity: ["severity", "keparahan", "tingkat keparahan"],
  environment: ["lingkungan", "environment", "env"],
  expected: ["diharapkan", "yang diharapkan", "expected"],
  actual: ["terjadi", "yang terjadi", "actual"],
  notes: ["catatan", "notes", "keterangan"],
  evidence_url: ["bukti url", "tautan bukti", "evidence url", "evidence_url", "url bukti"],
  is_retest: ["ulang", "pengujian ulang", "retest", "is retest", "is_retest"],
};

function normalizeHeader(v: string): string {
  return v
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function readSheet(
  buffer: Buffer,
  filename: string,
  sheetName: string | undefined,
): Promise<{ sheets: string[]; sheet: string; rows: string[][] }> {
  if (filename.toLowerCase().endsWith(".csv")) {
    return { sheets: ["CSV"], sheet: "CSV", rows: parseCsv(buffer.toString("utf8")) };
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

  const sheets = workbook.worksheets.map((ws) => ws.name);
  const selected =
    (sheetName ? workbook.getWorksheet(sheetName) : undefined) ??
    workbook.worksheets[0];
  if (!selected) return { sheets, sheet: "Sheet1", rows: [] };

  const rows: string[][] = [];
  selected.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value instanceof Date) {
        values.push(cell.value.toISOString().slice(0, 10));
      } else {
        values.push(String(cell.text ?? cell.value ?? "").trim());
      }
    });
    rows.push(values);
  });

  return { sheets, sheet: selected.name, rows };
}

function parseDate(value: string): string | null {
  const s = value.trim();
  if (isIsoDate(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

function parseResult(value: string): ImportResult | null {
  const s = value.trim().toLowerCase();
  if (["pass", "lulus", "ok"].includes(s)) return "pass";
  if (["fail", "gagal"].includes(s)) return "fail";
  if (["bug", "defect"].includes(s)) return "bug";
  return null;
}

function parseBool(value: string): boolean {
  return ["1", "ya", "true", "y", "yes"].includes(value.trim().toLowerCase());
}

export async function parseAndValidate(
  buffer: Buffer,
  filename: string,
  options: { sheet?: string; headerRow?: number; mapping?: ImportMapping } = {},
): Promise<ImportParseResult> {
  const headerRow = Math.max(1, Math.min(options.headerRow ?? 1, 1000));
  const { sheets, sheet, rows: allRows } = await readSheet(
    buffer,
    filename,
    options.sheet,
  );

  const headers = (allRows[headerRow - 1] ?? []).map((h) => String(h).trim());
  const dataRows = allRows.slice(headerRow);
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key !== "" && !headerIndex.has(key)) headerIndex.set(key, i);
  });

  const mapping: Record<ImportField, string | null> = {
    tested_at: null,
    email: null,
    role: null,
    cycle: null,
    feature: null,
    test_case: null,
    result: null,
    severity: null,
    environment: null,
    expected: null,
    actual: null,
    notes: null,
    evidence_url: null,
    is_retest: null,
  };

  for (const field of Object.keys(mapping) as ImportField[]) {
    const provided = options.mapping?.[field];
    if (provided) {
      const idx = headerIndex.get(normalizeHeader(provided));
      if (idx !== undefined) {
        mapping[field] = headers[idx];
        continue;
      }
    }
    for (const alias of HEADER_ALIASES[field]) {
      const idx = headerIndex.get(alias);
      if (idx !== undefined) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  const headerErrors: string[] = [];
  for (const field of IMPORT_FIELDS) {
    if (field.required && !mapping[field.key]) {
      headerErrors.push(`Kolom wajib "${field.label}" tidak ditemukan/dipetakan.`);
    }
  }

  const [users, features, roles, cycles, testCases, cycleScopeRows] = await Promise.all([
    query<{ id: string; email: string }>(`SELECT id, email FROM users`),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM features WHERE is_active=true`,
    ),
    query<{ name: string }>(
      `SELECT name FROM testing_roles WHERE is_active=true`,
    ),
    query<{ name: string }>(`SELECT name FROM test_cycles WHERE is_active=true`),
    query<{ feature_id: number; title: string; id: number }>(
      `SELECT tc.feature_id, tc.title, tc.id FROM test_cases tc
        JOIN features f ON f.id=tc.feature_id
       WHERE tc.is_active=true AND f.is_active=true`,
    ),
    query<{ cycle: string; feature_id: number }>(
      `SELECT c.name AS cycle, cf.feature_id
         FROM cycle_features cf JOIN test_cycles c ON c.id=cf.cycle_id`,
    ),
  ]);

  const userMap = new Map(
    users.map((u) => [u.email.trim().toLowerCase(), u.id]),
  );
  const featureMap = new Map(
    features.map((f) => [f.name.trim().toLowerCase(), f.id]),
  );
  const roleSet = new Set(roles.map((r) => r.name));
  const cycleSet = new Set(cycles.map((c) => c.name));
  const testCaseMap = new Map(
    testCases.map((tc) => [
      `${tc.feature_id}::${tc.title.trim().toLowerCase()}`,
      tc.id,
    ]),
  );
  const cycleScope = new Map<string, Set<number>>();
  for (const row of cycleScopeRows) {
    const set = cycleScope.get(row.cycle) ?? new Set<number>();
    set.add(row.feature_id);
    cycleScope.set(row.cycle, set);
  }

  const today = todayString();
  const parsed: ParsedImportRow[] = dataRows.map((raw, index) => {
    const get = (field: ImportField): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headerIndex.get(normalizeHeader(header));
      return idx === undefined ? "" : (raw[idx] ?? "").trim();
    };

    const testedAtRaw = get("tested_at");
    const testedAt = parseDate(testedAtRaw) ?? "";
    const email = get("email").toLowerCase();
    const featureName = get("feature");
    const role = get("role") || "tester";
    const cycle = get("cycle") || null;
    const testCaseTitle = get("test_case") || null;
    const resultRaw = get("result");
    const result = parseResult(resultRaw);
    const severityRaw = get("severity").toLowerCase();
    const severity = severityRaw || null;
    const environment = get("environment") || null;
    const expected = get("expected") || null;
    const actual = get("actual") || null;
    const notes = get("notes") || null;
    const evidenceUrl = get("evidence_url") || null;
    const isRetest = parseBool(get("is_retest"));
    const errors: string[] = [];

    if (!testedAtRaw) errors.push("Tanggal wajib diisi.");
    else if (!testedAt) errors.push("Tanggal harus YYYY-MM-DD atau DD/MM/YYYY yang valid.");
    else if (testedAt > today) errors.push("Tanggal tidak boleh di masa depan.");

    if (!email) errors.push("Email tester wajib diisi.");
    else if (!userMap.has(email)) errors.push(`Tester "${email}" tidak ditemukan.`);

    if (!featureName) errors.push("Nama fitur wajib diisi.");
    else if (!featureMap.has(featureName.toLowerCase()))
      errors.push(`Fitur "${featureName}" tidak ditemukan/nonaktif.`);

    if (!roleSet.has(role)) errors.push(`Peran "${role}" tidak valid/nonaktif.`);
    if (cycle && !cycleSet.has(cycle))
      errors.push(`Siklus "${cycle}" tidak valid/nonaktif.`);

    const featureId = featureMap.get(featureName.toLowerCase());
    if (cycle && featureId !== undefined) {
      const scope = cycleScope.get(cycle);
      if (scope && scope.size > 0 && !scope.has(featureId)) {
        errors.push(`Fitur "${featureName}" tidak termasuk lingkup siklus "${cycle}".`);
      }
    }

    if (!result) errors.push("Hasil harus Pass/Fail/Bug.");
    if (severity && !["low", "medium", "high", "critical"].includes(severity)) {
      errors.push("Severity harus low/medium/high/critical.");
    }
    if ((result === "fail" || result === "bug") && !severity) {
      errors.push("Severity wajib untuk Fail/Bug.");
    }
    if ((result === "fail" || result === "bug") && (!notes || notes.length < 10)) {
      errors.push("Catatan minimal 10 karakter untuk Fail/Bug.");
    }

    let testCaseId: number | null = null;
    if (testCaseTitle && featureId !== undefined) {
      testCaseId =
        testCaseMap.get(`${featureId}::${testCaseTitle.toLowerCase()}`) ?? null;
      if (testCaseId === null) {
        errors.push(`Test case "${testCaseTitle}" tidak ditemukan untuk fitur ini.`);
      }
    }

    if (evidenceUrl) {
      if (evidenceUrl.length > 2000) errors.push("URL bukti terlalu panjang.");
      else if (!/^https?:\/\//i.test(evidenceUrl))
        errors.push("URL bukti harus diawali http(s).");
    }

    const userId = userMap.get(email);
    const rowHash =
      userId && featureId
        ? createHash("sha256")
            .update(
              JSON.stringify({
                user: userId,
                feature: featureId,
                testCase: testCaseId,
                testedAt,
                role,
                cycle,
                result,
                severity,
                environment,
                expected,
                actual,
                notes,
                evidenceUrl,
                isRetest,
              }),
            )
            .digest("hex")
        : undefined;

    return {
      row: headerRow + index + 1,
      testedAt,
      testedAtRaw,
      email,
      featureName,
      role,
      cycle,
      testCaseTitle,
      result: result ?? "pass",
      severity,
      environment,
      expected,
      actual,
      notes,
      evidenceUrl,
      isRetest,
      errors,
      userId,
      featureId,
      testCaseId,
      rowHash,
    };
  });

  const valid = parsed.filter((r) => r.errors.length === 0).length;
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  return {
    rows: parsed,
    total: parsed.length,
    valid,
    invalid: parsed.length - valid,
    headers,
    sheets,
    sheet,
    headerRow,
    mapping,
    headerErrors,
    fileHash,
  };
}

export const IMPORT_HEADERS = IMPORT_FIELDS.map((f) => f.label);

export const IMPORT_TEMPLATE_SAMPLE = [
  "2026-11-01",
  "tester1@testlab.test",
  "Login Pengguna",
  "Pass",
  "tester",
  "Lensa-ASN R1",
  "Login dengan kredensial valid",
  "",
  "Chrome 126 / Windows 11",
  "Masuk ke dashboard",
  "Masuk ke dashboard",
  "",
  "",
  "0",
];
