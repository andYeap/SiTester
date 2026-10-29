import { err, needUser } from "@/lib/api";
import { query } from "@/lib/db";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const dari = sp.get("dari");
  const sampai = sp.get("sampai");
  const featureId = sp.get("feature_id");
  const result = sp.get("result");
  const q = sp.get("q")?.trim() ?? "";
  const cycle = sp.get("cycle")?.trim() ?? "";

  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (user.role !== "ketua_tim") {
    conds.push(`s.user_id = $${i++}`);
    vals.push(user.id);
  } else if (sp.get("user_id")) {
    conds.push(`s.user_id = $${i++}`);
    vals.push(sp.get("user_id"));
  }
  if (dari) {
    conds.push(`s.tested_at >= $${i++}`);
    vals.push(dari);
  }
  if (sampai) {
    conds.push(`s.tested_at <= $${i++}`);
    vals.push(sampai);
  }
  if (featureId) {
    conds.push(`s.feature_id = $${i++}`);
    vals.push(Number(featureId));
  }
  if (result && ["pass", "fail", "bug"].includes(result)) {
    conds.push(`s.result = $${i++}`);
    vals.push(result);
  }
  if (cycle) {
    conds.push(`s.test_cycle = $${i++}`);
    vals.push(cycle);
  }
  if (q) {
    conds.push(`(s.notes ILIKE $${i} OR f.name ILIKE $${i} OR u.name ILIKE $${i})`);
    vals.push(`%${q}%`);
    i++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = await query<{
    tested_at: string;
    user_name: string;
    tested_as_role: string;
    test_cycle: string | null;
    feature_name: string;
    result: string;
    severity: string | null;
    environment: string | null;
    is_retest: boolean;
    notes: string | null;
  }>(
    `SELECT s.tested_at::text, u.name AS user_name, s.tested_as_role, s.test_cycle,
            f.name AS feature_name, s.result, s.severity, s.environment,
            s.is_retest, s.notes
       FROM test_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN features f ON f.id = s.feature_id
      ${where}
      ORDER BY s.tested_at DESC, s.id DESC`,
    vals,
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
