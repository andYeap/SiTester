import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);

  const sp = new URL(request.url).searchParams;
  const action = sp.get("action")?.trim() || null;
  const q = sp.get("q")?.trim() || null;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (action) {
    conds.push(`a.action = $${i++}`);
    vals.push(action);
  }
  if (q) {
    conds.push(`(a.target ILIKE $${i} OR a.actor_name ILIKE $${i} OR a.action ILIKE $${i})`);
    vals.push(`%${q}%`);
    i++;
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const rows = await query(
    `SELECT a.id, a.actor_name, a.actor_role, a.action, a.target, a.changes, a.ip, a.created_at
       FROM audit_logs a
      ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 100`,
    vals,
  );
  return NextResponse.json({ logs: rows });
}
