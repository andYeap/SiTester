import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSessions } from "@/lib/history";
import { canTest, type TestResult } from "@/lib/retest";
import { saveEvidence } from "@/lib/storage";

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 5000);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);
  const { rows, total } = await getSessions(user.id, user.role === "ketua_tim", {
    dari: sp.get("dari") ?? undefined,
    sampai: sp.get("sampai") ?? undefined,
    userId: sp.get("user_id") ?? undefined,
    featureId: sp.get("feature_id") ?? undefined,
    result: sp.get("result") ?? undefined,
    q: sp.get("q")?.trim() || undefined,
    cycle: sp.get("cycle")?.trim() || undefined,
  }, { limit, offset });

  return NextResponse.json({ sessions: rows, total, limit, offset });
}

const RESULTS = ["pass", "fail", "bug"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const TODAY = () => new Date().toISOString().slice(0, 10);

export async function POST(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const form = await request.formData().catch(() => null);
  if (!form) return err("Form tidak valid.", 422);

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };

  const testedAt = str("tested_at");
  const featureId = Number(str("feature_id"));
  const isRetest = str("is_retest") === "1" || str("is_retest") === "true";
  const role = str("tested_as_role") || "tester";
  const cycle = str("test_cycle") || null;
  const result = str("result");
  const severity = str("severity") || null;
  const environment = str("environment") || null;
  const expected = str("expected") || null;
  const actual = str("actual") || null;
  const notes = str("notes") || null;
  const evidenceUrl = str("evidence_url") || null;
  const evidence = form.get("evidence");

  if (!testedAt || testedAt > TODAY()) {
    return err("Tanggal pengujian tidak boleh di masa depan.", 422);
  }
  if (!Number.isInteger(featureId)) {
    return err("Fitur yang dipilih tidak valid.", 422);
  }
  if (!RESULTS.includes(result as (typeof RESULTS)[number])) {
    return err("Status hasil tidak valid.", 422);
  }

  const feature = await queryOne<{ id: number; is_active: boolean }>(
    `SELECT id, is_active FROM features WHERE id=$1`,
    [featureId],
  );
  if (!feature || !feature.is_active) {
    return err("Fitur yang dipilih tidak aktif atau tidak ditemukan.", 422);
  }

  const roleOk = await queryOne<{ name: string }>(
    `SELECT name FROM testing_roles WHERE name=$1 AND is_active=true`,
    [role],
  );
  if (!roleOk) return err("Peran pengujian tidak valid.", 422);

  if (cycle) {
    const cyc = await queryOne<{ name: string }>(
      `SELECT name FROM test_cycles WHERE name=$1 AND is_active=true`,
      [cycle],
    );
    if (!cyc) return err("Siklus tidak valid.", 422);
  }

  if ((result === "fail" || result === "bug") && (!notes || notes.length < 10)) {
    return err("Catatan wajib diisi minimal 10 karakter untuk hasil Fail/Bug.", 422);
  }
  if ((result === "fail" || result === "bug") && !severity) {
    return err("Severity wajib dipilih untuk hasil Fail/Bug.", 422);
  }
  if (severity && !SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
    return err("Severity tidak valid.", 422);
  }
  if (evidenceUrl && evidenceUrl.length > 2000) {
    return err("Tautan bukti terlalu panjang.", 422);
  }
  if (evidenceUrl && !/^https?:\/\//.test(evidenceUrl)) {
    return err("Tautan bukti harus berupa URL http(s).", 422);
  }

  let evidencePath: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 2 * 1024 * 1024) {
      return err("Ukuran bukti maksimal 2MB.", 422);
    }
    if (!evidence.type.startsWith("image/")) {
      return err("Bukti harus berupa gambar.", 422);
    }
    evidencePath = await saveEvidence(evidence);
  }

  const last = await queryOne<{ result: TestResult }>(
    `SELECT result FROM test_sessions
      WHERE feature_id=$1 AND tested_as_role=$2
        AND ($3::text IS NULL OR test_cycle IS NOT DISTINCT FROM $3)
      ORDER BY tested_at DESC, id DESC LIMIT 1`,
    [featureId, role, cycle],
  );

  const approval = await queryOne<{ id: number }>(
    `SELECT id FROM retest_approvals
      WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3 AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
      ORDER BY id DESC LIMIT 1`,
    [featureId, user.id, role],
  );

  const check = canTest(last?.result ?? null, isRetest, approval !== null);
  if (!check.allowed) {
    return err(check.warning ?? "Pengujian tidak diizinkan.", 422);
  }

  const needsApproval = isRetest && last?.result === "pass";
  if (needsApproval && !approval) {
    return err(
      "Pengujian ulang memerlukan persetujuan ketua tim yang masih berlaku.",
      422,
    );
  }

  try {
    await withTransaction(async (client) => {
      let approvalId: number | null = null;
      if (needsApproval) {
        const locked = await client.query<{ id: number }>(
          `SELECT id FROM retest_approvals
            WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3 AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
            ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [featureId, user.id, role],
        );
        if (locked.rows.length === 0) {
          throw new Error(
            "Pengujian ulang memerlukan persetujuan ketua tim yang masih berlaku.",
          );
        }
        approvalId = locked.rows[0].id;
        await client.query(`UPDATE retest_approvals SET used_at=now() WHERE id=$1`, [
          approvalId,
        ]);
      }

      await client.query(
        `INSERT INTO test_sessions
          (user_id, feature_id, tested_at, result, severity, environment, expected, actual,
           notes, is_retest, tested_as_role, test_cycle, retest_approval_id, evidence_path, evidence_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          user.id, featureId, testedAt, result, severity, environment, expected,
          actual, notes, isRetest, role, cycle, approvalId, evidencePath, evidenceUrl,
        ],
      );
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Gagal menyimpan.", 422);
  }

  const recent = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions
      WHERE feature_id=$1 AND user_id<>$2 AND created_at >= now() - interval '24 hours'`,
    [featureId, user.id],
  );

  return NextResponse.json(
    {
      ok: true,
      warning:
        recent[0].n !== "0"
          ? "Perhatian: fitur ini baru saja diuji oleh tester lain dalam 24 jam terakhir."
          : null,
    },
    { status: 201 },
  );
}
