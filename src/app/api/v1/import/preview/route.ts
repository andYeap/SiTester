import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { parseAndValidate } from "@/lib/import";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return err("Pilih file Excel/CSV terlebih dahulu.", 422);
  }
  if (file.size > MAX_BYTES) {
    return err("Ukuran file maksimal 2MB.", 422);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseAndValidate(buffer, file.name);

    if (result.total > 5000) {
      return err("Maksimal 5000 baris per import.", 422);
    }
    if (result.total === 0) {
      return err("File tidak berisi baris data.", 422);
    }

    return NextResponse.json({
      summary: {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
      },
      rows: result.rows.slice(0, 500),
      truncated: result.total > 500,
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
