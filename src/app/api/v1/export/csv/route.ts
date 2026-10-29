import { err, needUser } from "@/lib/api";
import { getSessions } from "@/lib/history";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const { rows } = await getSessions(user.id, user.role === "ketua_tim", {
    dari: sp.get("dari") ?? undefined,
    sampai: sp.get("sampai") ?? undefined,
    userId: sp.get("user_id") ?? undefined,
    featureId: sp.get("feature_id") ?? undefined,
    result: sp.get("result") ?? undefined,
    q: sp.get("q")?.trim() || undefined,
    cycle: sp.get("cycle")?.trim() || undefined,
  }, { limit: 5000, offset: 0 });

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
