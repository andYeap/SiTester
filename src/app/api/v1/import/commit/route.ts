import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne, withTransaction } from "@/lib/db";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  parseAndValidate,
  type ImportMapping,
  type ParsedImportRow,
} from "@/lib/import";

export const maxDuration = 60;

const INSERT_COLUMNS = 16;

function parseMapping(value: FormDataEntryValue | null): ImportMapping {
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const mapping: ImportMapping = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim() !== "") {
        mapping[k as keyof ImportMapping] = v;
      }
    }
    return mapping;
  } catch {
    return {};
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return err("Pilih file Excel/CSV terlebih dahulu.", 422);
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return err(
      `Ukuran file maksimal ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)}MB.`,
      422,
    );
  }

  const sheet =
    typeof form?.get("sheet") === "string" ? String(form.get("sheet")) : undefined;
  const headerRowRaw = Number(form?.get("header_row") ?? 1);
  const headerRow =
    Number.isInteger(headerRowRaw) && headerRowRaw > 0 ? headerRowRaw : 1;
  const mapping = parseMapping(form?.get("mapping") ?? null);
  const skipInvalid =
    String(form?.get("skip_invalid") ?? "") === "1" ||
    String(form?.get("skip_invalid") ?? "") === "true";

  let result;
  try {
    result = await parseAndValidate(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      { sheet, headerRow, mapping },
    );
  } catch (e) {
    return err(
      e instanceof Error ? `Gagal membaca file: ${e.message}` : "Gagal membaca file.",
      422,
    );
  }

  if (result.total === 0) return err("File tidak berisi baris data.", 422);
  if (result.total > IMPORT_MAX_ROWS) {
    return err(`Maksimal ${IMPORT_MAX_ROWS} baris per import.`, 422);
  }
  if (result.headerErrors.length > 0) {
    return NextResponse.json(
      {
        error: "Kolom wajib belum lengkap.",
        headerErrors: result.headerErrors,
        mapping: result.mapping,
        headers: result.headers,
      },
      { status: 422 },
    );
  }
  if (result.invalid > 0 && !skipInvalid) {
    return NextResponse.json(
      {
        error: `Import dibatalkan: ${result.invalid} baris tidak valid. Aktifkan "lewati baris error" atau perbaiki file.`,
        summary: {
          total: result.total,
          valid: result.valid,
          invalid: result.invalid,
        },
        rows: result.rows.filter((r) => r.errors.length > 0).slice(0, 100),
      },
      { status: 422 },
    );
  }
  if (result.valid === 0) {
    return err("Tidak ada baris valid untuk diimport.", 422);
  }

  const validRows = result.rows.filter(
    (r) =>
      r.errors.length === 0 &&
      r.userId !== undefined &&
      r.featureId !== undefined &&
      r.rowHash,
  ) as (ParsedImportRow & {
    userId: string;
    featureId: number;
    rowHash: string;
  })[];

  const batch = await queryOne<{ id: string }>(
    `INSERT INTO import_batches
      (user_id, file_name, file_size, file_hash, kind, total, valid, invalid, status, mapping)
     VALUES ($1,$2,$3,$4,'sessions',$5,$6,$7,'processing',$8)
     RETURNING id`,
    [
      ketua.id,
      file.name,
      file.size,
      result.fileHash,
      result.total,
      result.valid,
      result.invalid,
      JSON.stringify(result.mapping),
    ],
  );
  const batchId = Number(batch?.id);

  let imported = 0;
  let skipped = 0;

  try {
    await withTransaction(async (client) => {
      for (const group of chunks(validRows, 100)) {
        const values: unknown[] = [];
        const placeholders: string[] = [];
        group.forEach((row, index) => {
          const b = index * INSERT_COLUMNS;
          placeholders.push(
            `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16})`,
          );
          values.push(
            row.userId,
            row.featureId,
            row.testCaseId,
            row.testedAt,
            row.result,
            row.severity,
            row.environment,
            row.expected,
            row.actual,
            row.notes,
            row.isRetest,
            row.role,
            row.cycle,
            row.evidenceUrl,
            batchId,
            row.rowHash,
          );
        });

        const inserted = await client.query<{
          id: string;
          import_row_hash: string;
        }>(
          `INSERT INTO test_sessions
            (user_id, feature_id, test_case_id, tested_at, result, severity,
             environment, expected, actual, notes, is_retest, tested_as_role,
             test_cycle, evidence_url, import_batch_id, import_row_hash)
           VALUES ${placeholders.join(",")}
           ON CONFLICT (import_row_hash) DO NOTHING
           RETURNING id, import_row_hash`,
          values,
        );

        imported += inserted.rows.length;
        skipped += group.length - inserted.rows.length;

        const byHash = new Map(group.map((row) => [row.rowHash, row]));
        const defectRows: {
          featureId: number;
          sessionId: number;
          featureName: string;
          testCaseTitle: string | null;
          severity: string | null;
          userId: string;
          testedAt: string;
        }[] = [];

        for (const insertedRow of inserted.rows) {
          const row = byHash.get(insertedRow.import_row_hash);
          if (!row || (row.result !== "fail" && row.result !== "bug")) continue;
          defectRows.push({
            featureId: row.featureId,
            sessionId: Number(insertedRow.id),
            featureName: row.featureName,
            testCaseTitle: row.testCaseTitle,
            severity: row.severity,
            userId: row.userId,
            testedAt: row.testedAt,
          });
        }

        for (const group2 of chunks(defectRows, 100)) {
          if (group2.length === 0) continue;
          const groupValues: unknown[] = [];
          const groupPlaceholders: string[] = [];
          group2.forEach((defect, index) => {
            const b = index * 6;
            groupPlaceholders.push(
              `($${b + 1},$${b + 2},$${b + 3},$${b + 4},'open',$${b + 5},$${b + 6}::date)`,
            );
            groupValues.push(
              defect.featureId,
              defect.sessionId,
              `Temuan: ${defect.featureName}${defect.testCaseTitle ? ` — ${defect.testCaseTitle}` : ""}`,
              defect.severity,
              defect.userId,
              defect.testedAt,
            );
          });
          await client.query(
            `INSERT INTO defects (feature_id, session_id, title, severity, status, created_by, created_at)
             VALUES ${groupPlaceholders.join(",")}`,
            groupValues,
          );
        }
      }
    });
  } catch (e) {
    await queryOne(
      `UPDATE import_batches SET status='failed' WHERE id=$1 RETURNING id`,
      [batchId],
    );
    console.error("import commit gagal", e);
    return err(
      "Gagal menyimpan hasil import. Coba lagi atau hubungi administrator.",
      500,
    );
  }

  await queryOne(
    `UPDATE import_batches
        SET imported=$1, skipped=$2, status='committed', committed_at=now()
      WHERE id=$3 RETURNING id`,
    [imported, skipped, batchId],
  );

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "import.test_sessions",
    target: file.name,
    changes: {
      batch_id: batchId,
      rows: result.total,
      valid: result.valid,
      invalid: result.invalid,
      imported,
      skipped_duplicate: skipped,
    },
    ip: clientIp(request),
  });

  return NextResponse.json(
    {
      ok: true,
      batchId,
      imported,
      skipped,
      valid: result.valid,
      invalid: result.invalid,
    },
    { status: 201 },
  );
}
