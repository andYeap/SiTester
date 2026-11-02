import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { query } from "@/lib/db";

const STATUSES = ["open", "fixed", "verified", "closed", "reopened"];

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const featureId = sp.get("feature_id");

  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (status && STATUSES.includes(status)) {
    conds.push(`d.status = $${i++}`);
    vals.push(status);
  }
  if (featureId && /^\d+$/.test(featureId)) {
    conds.push(`d.feature_id = $${i++}`);
    vals.push(Number(featureId));
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const rows = await query(
    `SELECT d.id, d.feature_id, d.session_id, d.title, d.severity, d.status,
            d.assignee, d.fix_reference, d.note, d.created_at, d.verified_at,
            f.name AS feature_name, c.name AS creator_name,
            v.name AS verifier_name
       FROM defects d
       JOIN features f ON f.id = d.feature_id
       LEFT JOIN users c ON c.id = d.created_by
       LEFT JOIN users v ON v.id = d.verified_by
      ${where}
      ORDER BY CASE d.status WHEN 'open' THEN 0 WHEN 'reopened' THEN 1 WHEN 'fixed' THEN 2 WHEN 'verified' THEN 3 ELSE 4 END,
               CASE d.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               d.created_at DESC
      LIMIT 200`,
    vals,
  );

  return NextResponse.json({ defects: rows });
}
