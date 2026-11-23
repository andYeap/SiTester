import { NextResponse } from "next/server";

import { err, needKetua } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne, withTransaction } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

const RESULTS = ["pass", "fail", "bug"];
const SEVERITIES = ["low", "medium", "high", "critical"];

type Row = {
  id: number;
  result: string;
  severity: string | null;
  environment: string | null;
  expected: string | null;
  actual: string | null;
  notes: string | null;
};

const text = (v: unknown, max = 2000): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("Riwayat tidak ditemukan.", 404);

  const existing = await queryOne<Row>(
    `SELECT id, result, severity, environment, expected, actual, notes
       FROM test_sessions WHERE id=$1`,
    [id],
  );
  if (!existing) return err("Riwayat tidak ditemukan.", 404);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const result = body?.result === undefined ? existing.result : String(body.result);
  if (!RESULTS.includes(result)) return err("Hasil pengujian tidak valid.", 422);
  const severityRaw = body?.severity === undefined ? existing.severity : body.severity;
  const severity = result === "pass" ? null : text(severityRaw, 20);
  if (severity !== null && !SEVERITIES.includes(severity)) {
    return err("Severity tidak valid.", 422);
  }

  const next = {
    result,
    severity,
    environment: body?.environment === undefined ? existing.environment : text(body.environment),
    expected: body?.expected === undefined ? existing.expected : text(body.expected),
    actual: body?.actual === undefined ? existing.actual : text(body.actual),
    notes: body?.notes === undefined ? existing.notes : text(body.notes),
  };

  await queryOne(
    `UPDATE test_sessions
        SET result=$1, severity=$2, environment=$3, expected=$4, actual=$5,
            notes=$6, updated_at=now()
      WHERE id=$7 RETURNING id`,
    [next.result, next.severity, next.environment, next.expected, next.actual, next.notes, id],
  );

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_sessions.update",
    target: `test_session#${id}`,
    changes: { from: existing, to: next },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ketua = await needKetua();
  if (!ketua) return err("Forbidden", 403);
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("Riwayat tidak ditemukan.", 404);
  const force = new URL(request.url).searchParams.get("force") === "1";

  // Cek tautan dan hapus di dalam satu transaksi supaya tidak ada defect
  // yang tertaut tepat di antara pemeriksaan dan penghapusan.
  // Hanya baris ini yang dihapus; FK memakai SET NULL sehingga defect dan
  // AI run tetap ada, hanya tautannya yang hilang.
  const outcome = await withTransaction(async (client) => {
    const row = await client.query<{
      id: number;
      feature_id: number;
      retest_approval_id: number | null;
      result: string;
      defect_count: number;
      from_ai: boolean;
    }>(
      `SELECT s.id, s.feature_id, s.retest_approval_id, s.result,
              (SELECT count(*) FROM defects d WHERE d.session_id=s.id)::int AS defect_count,
              EXISTS (SELECT 1 FROM ai_test_runs r WHERE r.confirmed_session_id=s.id) AS from_ai
         FROM test_sessions s WHERE s.id=$1 FOR UPDATE`,
      [id],
    );
    if (row.rows.length === 0) return { kind: "missing" as const };
    const session = row.rows[0];
    if (!force && (session.defect_count > 0 || session.from_ai)) {
      return { kind: "blocked" as const, session };
    }

    // AI run yang dikonfirmasi lewat sesi ini kembali menjadi draft agar bisa
    // dikonfirmasi ulang; tautannya otomatis NULL oleh FK.
    if (session.from_ai) {
      await client.query(
        `UPDATE ai_test_runs SET status='completed', updated_at=now()
          WHERE confirmed_session_id=$1 AND status='confirmed'`,
        [id],
      );
    }

    await client.query(`DELETE FROM test_sessions WHERE id=$1`, [id]);
    // Kembalikan jatah retest supaya persetujuan bisa dipakai lagi.
    if (session.retest_approval_id !== null) {
      await client.query(
        `UPDATE retest_approvals SET used_at=NULL WHERE id=$1`,
        [session.retest_approval_id],
      );
    }
    return { kind: "deleted" as const, session };
  });

  if (outcome.kind === "missing") return err("Riwayat tidak ditemukan.", 404);
  if (outcome.kind === "blocked") {
    const { defect_count: defectCount, from_ai: fromAi } = outcome.session;
    const sebab = [
      defectCount > 0
        ? `${defectCount} defect akan kehilangan tautan ke riwayat ini`
        : null,
      fromAi ? "riwayat ini sudah dikonfirmasi dari AI Test" : null,
    ]
      .filter(Boolean)
      .join(" dan ");
    return err(
      `Riwayat ini sebaiknya tidak dihapus langsung: ${sebab}. ` +
        "Defect dan AI run tidak ikut terhapus. Ulangi dengan ?force=1 bila tetap ingin menghapus satu riwayat ini.",
      409,
    );
  }

  await audit({
    actorId: ketua.id,
    actorName: ketua.name,
    actorRole: ketua.role,
    action: "test_sessions.delete",
    target: `test_session#${id}`,
    changes: {
      id: outcome.session.id,
      feature_id: outcome.session.feature_id,
      result: outcome.session.result,
      defect_count: outcome.session.defect_count,
      from_ai: outcome.session.from_ai,
      force,
    },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
