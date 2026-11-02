import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET() {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const rows = await query<{
    id: number;
    file_name: string;
    file_size: number;
    kind: string;
    total: number;
    valid: number;
    invalid: number;
    imported: number;
    skipped: number;
    status: string;
    user_name: string | null;
    created_at: string;
    committed_at: string | null;
  }>(
    `SELECT b.id, b.file_name, b.file_size, b.kind, b.total, b.valid, b.invalid,
            b.imported, b.skipped, b.status, u.name AS user_name,
            b.created_at::text AS created_at, b.committed_at::text AS committed_at
       FROM import_batches b
       LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.created_at DESC
      LIMIT 50`,
  );

  return NextResponse.json({
    batches: rows.map((row) => ({ ...row, id: Number(row.id) })),
  });
}
