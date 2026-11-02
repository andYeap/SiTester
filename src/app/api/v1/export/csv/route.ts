import { err, needUser } from "@/lib/api";
import { getSessions, parseSessionFilters } from "@/lib/history";

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Cegah formula injection saat dibuka di Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const parsed = parseSessionFilters(new URL(request.url).searchParams);
  if ("error" in parsed) return err(parsed.error, 422);

  const { rows } = await getSessions(
    user.id,
    user.role === "ketua_tim",
    parsed.filters,
    { limit: 5000, offset: 0 },
  );

  const lines = [
    ["Tanggal", "Tester", "Peran", "Siklus", "Fitur", "Hasil", "Severity", "Lingkungan", "Pengujian Ulang", "Catatan"].map(csvCell).join(","),
  ];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.tested_at),
        csvCell(r.user_name),
        csvCell(r.tested_as_role),
        csvCell(r.test_cycle ?? ""),
        csvCell(r.feature_name),
        csvCell(r.result.toUpperCase()),
        csvCell((r.severity ?? "").toUpperCase()),
        csvCell(r.environment ?? ""),
        csvCell(r.is_retest ? "Ya" : "Tidak"),
        csvCell(r.notes ?? ""),
      ].join(","),
    );
  }

  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": `attachment; filename="laporan-pengujian-${stamp}.csv"`,
    },
  });
}
