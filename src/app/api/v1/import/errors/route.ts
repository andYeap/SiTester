import { err, needKetua } from "@/lib/api";
import { IMPORT_MAX_BYTES, parseAndValidate, type ImportMapping } from "@/lib/import";

export const maxDuration = 60;

function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

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
    return err("Pilih file terlebih dahulu.", 422);
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return err("Ukuran file melebihi batas.", 422);
  }

  const sheet =
    typeof form?.get("sheet") === "string" ? String(form.get("sheet")) : undefined;
  const headerRowRaw = Number(form?.get("header_row") ?? 1);
  const headerRow =
    Number.isInteger(headerRowRaw) && headerRowRaw > 0 ? headerRowRaw : 1;
  const mapping = parseMapping(form?.get("mapping") ?? null);

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

  if (result.headerErrors.length > 0) {
    return err(result.headerErrors.join(" "), 422);
  }

  const invalid = result.rows.filter((row) => row.errors.length > 0);
  const lines = [
    ["Baris", "Error", "Tanggal", "Email", "Fitur", "Peran", "Siklus", "Hasil", "Severity", "Catatan"]
      .map(cell)
      .join(","),
  ];

  for (const row of invalid) {
    lines.push(
      [
        cell(row.row),
        cell(row.errors.join("; ")),
        cell(row.testedAtRaw || row.testedAt),
        cell(row.email),
        cell(row.featureName),
        cell(row.role),
        cell(row.cycle ?? ""),
        cell(row.result.toUpperCase()),
        cell(row.severity ?? ""),
        cell(row.notes ?? ""),
      ].join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": `attachment; filename="error-import-${stamp}.csv"`,
    },
  });
}
