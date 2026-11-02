import { NextResponse } from "next/server";

import { err } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
import { saveEvidence } from "@/lib/storage";
import { parsePositiveInt } from "@/lib/validation";

export const maxDuration = 60;

const OUTCOMES = ["pass", "fail", "bug", "error"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isRunnerAuthorized(request)) return runnerUnauthorized();

  const id = parsePositiveInt((await params).id);
  if (id === null) return err("AI run tidak ditemukan.", 404);

  const run = await queryOne<{ id: number; status: string }>(
    `SELECT id, status FROM ai_test_runs WHERE id=$1`,
    [id],
  );
  if (!run) return err("AI run tidak ditemukan.", 404);
  if (run.status !== "running") {
    return err("AI run ini tidak sedang dijalankan.", 422);
  }

  const form = await request.formData().catch(() => null);
  const outcome = String(form?.get("outcome") ?? "");
  if (!OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])) {
    return err("Outcome runner tidak valid.", 422);
  }

  const notesRaw = form?.get("notes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() !== ""
      ? notesRaw.trim().slice(0, 4000)
      : null;
  const errorRaw = form?.get("error");
  const error =
    typeof errorRaw === "string" && errorRaw.trim() !== ""
      ? errorRaw.trim().slice(0, 4000)
      : null;
  const severityRaw = String(form?.get("severity") ?? "");
  const severity =
    outcome === "fail" || outcome === "bug"
      ? ["low", "medium", "high", "critical"].includes(severityRaw)
        ? severityRaw
        : "medium"
      : null;

  let evidencePath: string | null = null;
  const evidence = form?.get("evidence");
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

  const failed = outcome === "error";
  const updated = await queryOne<{ id: number }>(
    `UPDATE ai_test_runs
        SET status=$1,
            result=$2,
            severity=$3,
            notes=$4,
            error=$5,
            evidence_path=coalesce($6, evidence_path),
            finished_at=now(),
            updated_at=now()
      WHERE id=$7 AND status='running'
      RETURNING id`,
    [
      failed ? "failed" : "completed",
      failed ? null : outcome,
      severity,
      notes,
      error,
      evidencePath,
      id,
    ],
  );
  if (!updated) return err("AI run sudah diproses runner lain.", 409);

  return NextResponse.json({ ok: true });
}
