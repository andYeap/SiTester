import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, IMPORT_PREVIEW_ROWS, parseAndValidate, type ImportMapping } from "@/lib/import";

export const maxDuration = 60;

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

  try {
    const result = await parseAndValidate(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      { sheet, headerRow, mapping },
    );

    if (result.total === 0) {
      return err(
        result.headerErrors.length > 0
          ? result.headerErrors.join(" ")
          : "File tidak berisi baris data.",
        422,
      );
    }
    if (result.total > IMPORT_MAX_ROWS) {
      return err(`Maksimal ${IMPORT_MAX_ROWS} baris per import.`, 422);
    }

    return NextResponse.json({
      summary: {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
      },
      headerErrors: result.headerErrors,
      headers: result.headers,
      sheets: result.sheets,
      sheet: result.sheet,
      headerRow: result.headerRow,
      mapping: result.mapping,
      fileHash: result.fileHash,
      rows: result.rows.slice(0, IMPORT_PREVIEW_ROWS),
      truncated: result.total > IMPORT_PREVIEW_ROWS,
    });
  } catch (e) {
    return err(
      e instanceof Error
        ? `Gagal membaca file: ${e.message}`
        : "Gagal membaca file.",
      422,
    );
  }
}
