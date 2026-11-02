import ExcelJS from "exceljs";

import { query } from "@/lib/db";
import { todayString } from "@/lib/time";
import { isIsoDate } from "@/lib/validation";

export type ImportResult = "pass" | "fail" | "bug";

export type ParsedImportRow = {
  row: number;
  testedAt: string;
  email: string;
  featureName: string;
  role: string;
  cycle: string | null;
  result: ImportResult;
  severity: string | null;
  environment: string | null;
  notes: string | null;
  isRetest: boolean;
  errors: string[];
  userId?: string;
  featureId?: number;
};

const HEADER_ALIASES: Record<string, string> = {
  tanggal: "tested_at",
  date: "tested_at",
  "tanggal pengujian": "tested_at",
  email: "email",
  tester: "email",
  "email tester": "email",
  peran: "role",
  role: "role",
  "peran uji": "role",
  siklus: "cycle",
  cycle: "cycle",
  fitur: "feature",
  feature: "feature",
  hasil: "result",
  result: "result",
  severity: "severity",
  keparahan: "severity",
  lingkungan: "environment",
  environment: "environment",
  catatan: "notes",
  notes: "notes",
  ulang: "is_retest",
  "pengujian ulang": "is_retest",
  retest: "is_retest",
};

function normalizeHeader(v: string): string {
  return v
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
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

async function readRows(
  buffer: Buffer,
  filename: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  if (filename.toLowerCase().endsWith(".csv")) {
    const all = parseCsv(buffer.toString("utf8"));
    const headers = all[0] ?? [];
    return { headers, rows: all.slice(1) };
  }

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const all: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value instanceof Date) {
        values.push(cell.value.toISOString().slice(0, 10));
      } else {
        values.push(String(cell.text ?? cell.value ?? "").trim());
      }
    });
    all.push(values);
  });

  const headers = all[0] ?? [];
  return { headers, rows: all.slice(1) };
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
): Promise<{
  rows: ParsedImportRow[];
  total: number;
  valid: number;
  invalid: number;
}> {
  const { headers, rows } = await readRows(buffer, filename);
  const mapped = headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);

  const [users, features, roles, cycles] = await Promise.all([
    query<{ id: string; email: string }>(`SELECT id, email FROM users`),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM features WHERE is_active=true`,
    ),
    query<{ name: string }>(
      `SELECT name FROM testing_roles WHERE is_active=true`,
    ),
    query<{ name: string }>(`SELECT name FROM test_cycles WHERE is_active=true`),
  ]);

  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const featureMap = new Map(
    features.map((f) => [f.name.trim().toLowerCase(), f.id]),
  );
  const roleSet = new Set(roles.map((r) => r.name));
  const cycleSet = new Set(cycles.map((c) => c.name));

  const today = todayString();
  const parsed: ParsedImportRow[] = rows.map((raw, index) => {
    const get = (key: string): string => {
      const pos = mapped.indexOf(key);
      return pos >= 0 ? (raw[pos] ?? "").trim() : "";
    };

    const testedAtRaw = get("tested_at");
    const testedAt = parseDate(testedAtRaw) ?? "";
    const email = get("email").toLowerCase();
    const featureName = get("feature");
    const role = get("role") || "tester";
    const cycle = get("cycle") || null;
    const resultRaw = get("result");
    const result = parseResult(resultRaw);
    const severityRaw = get("severity").toLowerCase();
    const severity = severityRaw || null;
    const environment = get("environment") || null;
    const notes = get("notes") || null;
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

    return {
      row: index + 2,
      testedAt,
      email,
      featureName,
      role,
      cycle,
      result: result ?? "pass",
      severity,
      environment,
      notes,
      isRetest,
      errors,
      userId: userMap.get(email),
      featureId: featureMap.get(featureName.toLowerCase()),
    };
  });

  const valid = parsed.filter((r) => r.errors.length === 0).length;
  return {
    rows: parsed,
    total: parsed.length,
    valid,
    invalid: parsed.length - valid,
  };
}

export const IMPORT_HEADERS = [
  "Tanggal",
  "Email Tester",
  "Peran",
  "Siklus",
  "Fitur",
  "Hasil",
  "Severity",
  "Lingkungan",
  "Catatan",
  "Ulang",
];
