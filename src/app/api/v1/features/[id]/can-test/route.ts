import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { canTest } from "@/lib/retest";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const isRetest = sp.get("is_retest") === "1";
  const cycle = sp.get("cycle") || null;

  const feature = await queryOne<{ id: number; is_active: boolean }>(
    `SELECT id, is_active FROM features WHERE id = $1`,
    [Number(id)],
  );
  if (!feature) return err("Fitur tidak ditemukan.", 404);
  if (!feature.is_active) {
    return NextResponse.json({
      allowed: false,
      requiresApproval: false,
      warning: "Fitur yang dipilih tidak aktif atau tidak ditemukan.",
      lastResult: null,
      hasPendingRequest: false,
    });
  }

  let role = sp.get("role") ?? "tester";
  const roleOk = await queryOne<{ name: string }>(
    `SELECT name FROM testing_roles WHERE name=$1 AND is_active=true`,
    [role],
  );
  if (!roleOk) {
    const fallback = await queryOne<{ name: string }>(
      `SELECT name FROM testing_roles WHERE is_active=true ORDER BY name LIMIT 1`,
    );
    role = fallback?.name ?? "tester";
  }

  if (cycle) {
    const cyc = await queryOne<{ name: string }>(
      `SELECT name FROM test_cycles WHERE name=$1 AND is_active=true`,
      [cycle],
    );
    if (!cyc) return err("Siklus tidak valid.", 422);
  }

  const last = await queryOne<{ result: "pass" | "fail" | "bug" }>(
    `SELECT result FROM test_sessions
      WHERE feature_id=$1 AND tested_as_role=$2
        AND ($3::text IS NULL OR test_cycle IS NOT DISTINCT FROM $3)
      ORDER BY tested_at DESC, id DESC LIMIT 1`,
    [feature.id, role, cycle],
  );

  const approval = await queryOne<{ id: number }>(
    `SELECT id FROM retest_approvals
      WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3 AND used_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [feature.id, user.id, role],
  );

  const check = canTest(last?.result ?? null, isRetest, approval !== null);

  const pending = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests
      WHERE feature_id=$1 AND status='pending'`,
    [feature.id],
  );
  const ownPending = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests
      WHERE feature_id=$1 AND user_id=$2 AND status='pending'`,
    [feature.id, user.id],
  );

  const recent = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions
      WHERE feature_id=$1 AND user_id<>$2 AND created_at >= now() - interval '24 hours'`,
    [feature.id, user.id],
  );

  return NextResponse.json({
    ...check,
    lastResult: last?.result ?? null,
    hasPendingRequest: pending[0].n !== "0",
    hasPendingRequestOwn: ownPending[0].n !== "0",
    duplicateWarning:
      recent[0].n !== "0"
        ? "Perhatian: fitur ini baru saja diuji oleh tester lain dalam 24 jam terakhir."
        : null,
  });
}
