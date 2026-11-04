import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { canTest } from "@/lib/retest";
import { parsePositiveInt } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const { id } = await params;
  const featureId = parsePositiveInt(id);
  if (featureId === null) return err("Fitur tidak ditemukan.", 404);
  const sp = new URL(request.url).searchParams;
  const isRetest = sp.get("is_retest") === "1";
  const cycle = sp.get("cycle") || null;

  const feature = await queryOne<{ id: number; is_active: boolean }>(
    `SELECT id, is_active FROM features WHERE id = $1`,
    [featureId],
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

    const scoped = await queryOne<{ n: string }>(
      `SELECT count(*)::text AS n FROM cycle_features cf
        JOIN test_cycles c ON c.id = cf.cycle_id WHERE c.name=$1`,
      [cycle],
    );
    if (Number(scoped?.n ?? 0) > 0) {
      const inScope = await queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM cycle_features cf
          JOIN test_cycles c ON c.id = cf.cycle_id
         WHERE c.name=$1 AND cf.feature_id=$2`,
        [cycle, featureId],
      );
      if (Number(inScope?.n ?? 0) === 0) {
        return NextResponse.json({
          allowed: false,
          requiresApproval: false,
          warning: `Fitur ini tidak termasuk dalam lingkup "${cycle}". Pilih fitur yang terdaftar di siklus tersebut, atau minta ketua tim menambahkannya.`,
          lastResult: null,
          hasPendingRequest: false,
          duplicateWarning: null,
        });
      }
    }
  }

  const last = await queryOne<{ result: "pass" | "fail" | "bug" }>(
    `SELECT result FROM test_sessions
      WHERE feature_id=$1 AND tested_as_role=$2
        AND test_cycle IS NOT DISTINCT FROM $3
      ORDER BY tested_at DESC, id DESC LIMIT 1`,
    [feature.id, role, cycle],
  );

  const approval = await queryOne<{ id: number }>(
    `SELECT id FROM retest_approvals
      WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3 AND test_cycle IS NOT DISTINCT FROM $4 AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
      ORDER BY id DESC LIMIT 1`,
    [feature.id, user.id, role, cycle],
  );

  const check = canTest(last?.result ?? null, isRetest, approval !== null);

  const pending = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests
      WHERE feature_id=$1 AND tested_as_role=$2 AND test_cycle IS NOT DISTINCT FROM $3 AND status='pending' AND expires_at > now()`,
    [feature.id, role, cycle],
  );
  const ownPending = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests
      WHERE feature_id=$1 AND user_id=$2 AND tested_as_role=$3 AND test_cycle IS NOT DISTINCT FROM $4 AND status='pending' AND expires_at > now()`,
    [feature.id, user.id, role, cycle],
  );

  const recent = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions
      WHERE feature_id=$1 AND user_id<>$2
        AND tested_at >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1)`,
    [feature.id, user.id],
  );

  return NextResponse.json({
    ...check,
    lastResult: last?.result ?? null,
    hasPendingRequest: pending[0].n !== "0",
    hasPendingRequestOwn: ownPending[0].n !== "0",
    duplicateWarning:
      recent[0].n !== "0"
        ? "Perhatian: fitur ini baru saja diuji oleh tester lain sejak kemarin."
        : null,
  });
}
