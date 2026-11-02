import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { withTransaction } from "@/lib/db";
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

  let result;
  try {
    result = await parseAndValidate(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    );
  } catch (e) {
    return err(
      e instanceof Error ? `Gagal membaca file: ${e.message}` : "Gagal membaca file.",
      422,
    );
  }

  if (result.total === 0) return err("File tidak berisi baris data.", 422);
  if (result.total > 5000) return err("Maksimal 5000 baris per import.", 422);
  if (result.invalid > 0) {
    return NextResponse.json(
      {
        error: `Import dibatalkan: ${result.invalid} baris tidak valid.`,
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

  try {
    await withTransaction(async (client) => {
      for (const row of result.rows) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO test_sessions
            (user_id, feature_id, tested_at, result, severity, environment, notes,
             is_retest, tested_as_role, test_cycle)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [
            row.userId,
            row.featureId,
            row.testedAt,
            row.result,
            row.severity,
            row.environment,
            row.notes,
            row.isRetest,
            row.role,
            row.cycle,
          ],
        );

        if (row.result === "fail" || row.result === "bug") {
          await client.query(
            `INSERT INTO defects (feature_id, session_id, title, severity, status, created_by)
             VALUES ($1,$2,$3,$4,'open',$5)`,
            [
              row.featureId,
              inserted.rows[0].id,
              `Temuan: ${row.featureName}`,
              row.severity,
              row.userId,
            ],
          );
        }
      }
    });
  } catch (e) {
    return err(
      e instanceof Error ? `Gagal menyimpan: ${e.message}` : "Gagal menyimpan.",
      422,
    );
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "import.test_sessions",
    target: file.name,
    changes: { rows: result.total },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, imported: result.total }, { status: 201 });
}
