import { NextResponse } from "next/server";

import { err, needUser, UserError } from "@/lib/api";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSessions, parseSessionFilters } from "@/lib/history";
import { canTest, type TestResult } from "@/lib/retest";
import { saveEvidence } from "@/lib/storage";
import { todayString } from "@/lib/time";
import { isIsoDate } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const parsed = parseSessionFilters(sp);
  if ("error" in parsed) return err(parsed.error, 422);

  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 5000);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);
  const { rows, total } = await getSessions(
    user.id,
    user.role === "ketua_tim",
    parsed.filters,
    { limit, offset },
  );

  return NextResponse.json({ sessions: rows, total, limit, offset });
}

const RESULTS = ["pass", "fail", "bug"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const TODAY = () => todayString();

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
  const testCaseRaw = str("test_case_id");
  const testCaseId = testCaseRaw === "" ? null : Number(testCaseRaw);
  const aiRunRaw = str("ai_run_id");
  const aiRunId = aiRunRaw === "" ? null : Number(aiRunRaw);
  const idempotencyKey =
    request.headers.get("Idempotency-Key")?.trim().slice(0, 100) || null;

  // Replay: kunci yang sama mengembalikan sesi yang sudah ada tanpa efek ganda.
  if (idempotencyKey) {
    const existing = await queryOne<{ id: number; defect_id: number | null }>(
      `SELECT s.id, (SELECT d.id FROM defects d WHERE d.session_id=s.id ORDER BY d.id LIMIT 1) AS defect_id
         FROM test_sessions s WHERE s.idempotency_key=$1 AND s.user_id=$2`,
      [idempotencyKey, user.id],
    );
    if (existing) {
      return NextResponse.json(
        { ok: true, sessionId: Number(existing.id), defectId: existing.defect_id !== null ? Number(existing.defect_id) : null, deduped: true, warning: null },
        { status: 200 },
      );
    }
  }

  if (!testedAt || !isIsoDate(testedAt)) {
    return err("Tanggal pengujian tidak valid (format YYYY-MM-DD).", 422);
  }
  if (testedAt > TODAY()) {
    return err("Tanggal pengujian tidak boleh di masa depan.", 422);
  }
  if (!Number.isInteger(featureId)) {
    return err("Fitur yang dipilih tidak valid.", 422);
  }
  if (!RESULTS.includes(result as (typeof RESULTS)[number])) {
    return err("Status hasil tidak valid.", 422);
  }

  const feature = await queryOne<{ id: number; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM features WHERE id=$1`,
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
        return err(
          `Fitur ini tidak termasuk dalam lingkup "${cycle}". Pilih fitur yang terdaftar di siklus tersebut, atau minta ketua tim menambahkannya.`,
          422,
        );
      }
    }
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

  if (testCaseId !== null) {
    if (!Number.isInteger(testCaseId) || testCaseId <= 0) {
      return err("Test case tidak valid.", 422);
    }
    const testCase = await queryOne<{ id: number }>(
      `SELECT id FROM test_cases
        WHERE id=$1 AND feature_id=$2 AND is_active=true`,
      [testCaseId, featureId],
    );
    if (!testCase) {
      return err("Test case harus milik fitur ini dan aktif.", 422);
    }
  }

  let aiRun: {
    id: number;
    created_by: string;
    status: string;
    feature_id: number;
    tested_as_role: string;
    test_cycle: string | null;
    evidence_path: string | null;
    confirmed_session_id: number | null;
  } | null = null;

  if (aiRunId !== null) {
    if (!Number.isInteger(aiRunId) || aiRunId <= 0) {
      return err("AI run tidak valid.", 422);
    }
    aiRun = await queryOne<{
      id: number;
      created_by: string;
      status: string;
      feature_id: number;
      tested_as_role: string;
      test_cycle: string | null;
      evidence_path: string | null;
      confirmed_session_id: number | null;
    }>(
      `SELECT id, created_by, status, feature_id, tested_as_role, test_cycle,
              evidence_path, confirmed_session_id
         FROM ai_test_runs WHERE id=$1`,
      [aiRunId],
    );
    if (!aiRun) return err("AI run tidak ditemukan.", 404);
    if (aiRun.created_by !== user.id && user.role !== "ketua_tim") {
      return err("Forbidden", 403);
    }
    if (aiRun.status !== "completed" || aiRun.confirmed_session_id !== null) {
      return err("Hasil AI ini sudah dikonfirmasi atau belum selesai.", 422);
    }
    if (
      Number(aiRun.feature_id) !== featureId ||
      aiRun.tested_as_role !== role ||
      (aiRun.test_cycle ?? null) !== cycle
    ) {
      return err(
        "Hasil AI ini berasal dari fitur, peran, atau siklus yang berbeda.",
        422,
      );
    }
  }

  let evidencePath: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 2 * 1024 * 1024) {
      return err("Ukuran bukti maksimal 2MB.", 422);
    }
    try {
      evidencePath = await saveEvidence(evidence);
    } catch (e) {
      return err(
        e instanceof Error ? e.message : "Gagal menyimpan bukti.",
        422,
      );
    }
  }
  if (aiRun && evidencePath === null) {
    evidencePath = aiRun.evidence_path;
  }

  const last = await queryOne<{ result: TestResult }>(
    `SELECT result FROM test_sessions
      WHERE feature_id=$1 AND tested_as_role=$2
        AND test_cycle IS NOT DISTINCT FROM $3
      ORDER BY tested_at DESC, id DESC LIMIT 1`,
    [featureId, role, cycle],
  );

  const approval = await queryOne<{ id: number }>(
    `SELECT id FROM retest_approvals
      WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3 AND test_cycle IS NOT DISTINCT FROM $4 AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
      ORDER BY id DESC LIMIT 1`,
    [featureId, user.id, role, cycle],
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

  let saved: { sessionId: number; defectId: number | null; deduped?: boolean } = {
    sessionId: 0,
    defectId: null,
  };

  try {
    saved = await withTransaction(async (client) => {
      // Kunci scope agar dua submit bersamaan tidak sama-sama lolos cek last.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `test:${featureId}:${role}:${cycle ?? ""}`,
      ]);

      if (idempotencyKey) {
        const winner = await client.query<{
          id: number;
          defect_id: number | null;
        }>(
          `SELECT s.id, (SELECT d.id FROM defects d WHERE d.session_id=s.id ORDER BY d.id LIMIT 1) AS defect_id
             FROM test_sessions s
            WHERE s.idempotency_key=$1 AND s.user_id=$2
            LIMIT 1`,
          [idempotencyKey, user.id],
        );
        if (winner.rows.length > 0) {
          return {
            sessionId: Number(winner.rows[0].id),
            defectId:
              winner.rows[0].defect_id !== null
                ? Number(winner.rows[0].defect_id)
                : null,
            deduped: true,
          };
        }
      }

      const lastLocked = await client.query<{ result: TestResult }>(
        `SELECT result FROM test_sessions
          WHERE feature_id=$1 AND tested_as_role=$2
            AND test_cycle IS NOT DISTINCT FROM $3
          ORDER BY tested_at DESC, id DESC LIMIT 1`,
        [featureId, role, cycle],
      );
      const approvalLocked = await client.query<{ id: number }>(
        `SELECT id FROM retest_approvals
          WHERE feature_id=$1 AND requested_by=$2 AND scope_role=$3
            AND test_cycle IS NOT DISTINCT FROM $4
            AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [featureId, user.id, role, cycle],
      );
      const checkLocked = canTest(
        lastLocked.rows[0]?.result ?? null,
        isRetest,
        approvalLocked.rows.length > 0,
      );
      if (!checkLocked.allowed) {
        throw new UserError(
          checkLocked.warning ?? "Pengujian tidak diizinkan.",
        );
      }

      let approvalId: number | null = null;
      if (isRetest && lastLocked.rows[0]?.result === "pass") {
        if (approvalLocked.rows.length === 0) {
          throw new UserError(
            "Pengujian ulang memerlukan persetujuan ketua tim yang masih berlaku.",
          );
        }
        approvalId = approvalLocked.rows[0].id;
        await client.query(`UPDATE retest_approvals SET used_at=now() WHERE id=$1`, [
          approvalId,
        ]);
      }

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO test_sessions
          (user_id, feature_id, test_case_id, tested_at, result, severity, environment, expected, actual,
           notes, is_retest, tested_as_role, test_cycle, retest_approval_id, evidence_path, evidence_url, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          user.id, featureId, testCaseId, testedAt, result, severity, environment,
          expected, actual, notes, isRetest, role, cycle, approvalId, evidencePath,
          evidenceUrl, idempotencyKey,
        ],
      );

      const sessionId = Number(inserted.rows[0].id);
      let defectId: number | null = null;

      if (aiRun) {
        const confirmed = await client.query<{ id: number }>(
          `UPDATE ai_test_runs
              SET status='confirmed', confirmed_session_id=$1, updated_at=now()
            WHERE id=$2 AND status='completed' AND confirmed_session_id IS NULL
            RETURNING id`,
          [sessionId, aiRun.id],
        );
        if (confirmed.rows.length === 0) {
          throw new UserError("Hasil AI ini sudah dikonfirmasi pengguna lain.");
        }
      }

      if (result === "fail" || result === "bug") {
        const defect = await client.query<{ id: number }>(
          `INSERT INTO defects (feature_id, session_id, title, severity, status, created_by)
           VALUES ($1,$2,$3,$4,'open',$5) RETURNING id`,
          [
            featureId,
            sessionId,
            `Temuan: ${feature.name}`,
            severity,
            user.id,
          ],
        );
        defectId = Number(defect.rows[0].id);
      }

      return { sessionId, defectId };
    });
  } catch (e) {
    // Balapan double-submit: kunci sama menang satu, yang kalah ambil sesi pemenang.
    const pg = e as { code?: string; constraint?: string };
    if (idempotencyKey && (pg.code === "23505" || /idempotency/i.test(pg.constraint ?? "") || /idempotency/i.test(e instanceof Error ? e.message : ""))) {
      const winner = await queryOne<{ id: number; defect_id: number | null }>(
        `SELECT s.id, (SELECT d.id FROM defects d WHERE d.session_id=s.id ORDER BY d.id LIMIT 1) AS defect_id
           FROM test_sessions s WHERE s.idempotency_key=$1 AND s.user_id=$2`,
        [idempotencyKey, user.id],
      );
      if (winner) {
        return NextResponse.json(
          { ok: true, sessionId: Number(winner.id), defectId: winner.defect_id !== null ? Number(winner.defect_id) : null, deduped: true, warning: null },
          { status: 200 },
        );
      }
    }
    if (e instanceof UserError) return err(e.message, e.status);
    console.error("test-sessions POST gagal", e);
    return err(
      "Gagal menyimpan pengujian. Coba lagi atau hubungi administrator.",
      500,
    );
  }

  if (saved.deduped) {
    return NextResponse.json(
      {
        ok: true,
        sessionId: saved.sessionId,
        defectId: saved.defectId,
        deduped: true,
        warning: null,
      },
      { status: 200 },
    );
  }

  const recent = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM test_sessions
      WHERE feature_id=$1 AND user_id<>$2
        AND tested_at >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1)`,
    [featureId, user.id],
  );

  return NextResponse.json(
    {
      ok: true,
      sessionId: saved.sessionId,
      defectId: saved.defectId,
      warning:
        recent[0].n !== "0"
          ? "Perhatian: fitur ini baru saja diuji oleh tester lain sejak kemarin."
          : null,
    },
    { status: 201 },
  );
}
