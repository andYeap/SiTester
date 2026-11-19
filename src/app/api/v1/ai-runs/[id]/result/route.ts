import { NextResponse } from "next/server";

import { err } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";
import { saveEvidence } from "@/lib/storage";
import { parsePositiveInt } from "@/lib/validation";

export const maxDuration = 60;

const OUTCOMES = ["pass", "fail", "bug", "error"] as const;

const MAX_SHOTS = 8;
const MAX_SHOT_BYTES = 2 * 1024 * 1024;

function parseLabels(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v).slice(0, 200)) : [];
  } catch {
    return [];
  }
}

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
  const logRaw = form?.get("log");
  const runnerLog =
    typeof logRaw === "string" && logRaw.trim() !== ""
      ? logRaw.slice(0, 100_000)
      : null;
  const severityRaw = String(form?.get("severity") ?? "");
  const severity =
    outcome === "fail" || outcome === "bug"
      ? ["low", "medium", "high", "critical"].includes(severityRaw)
        ? severityRaw
        : "medium"
      : null;

  const warnings: string[] = [];
  const labels = parseLabels(form?.get("screenshot_labels") ?? null);
  const gallery: { path: string; label: string }[] = [];

  // Bukti bersifat best-effort: hasil tetap disimpan walau storage belum siap.
  async function store(file: File, label: string): Promise<string | null> {
    if (file.size > MAX_SHOT_BYTES) {
      warnings.push(`${label} dilewati karena lebih dari 2MB.`);
      return null;
    }
    try {
      return await saveEvidence(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      warnings.push(
        message.startsWith("Bukti harus") ? message : `Gagal menyimpan ${label}.`,
      );
      if (!message.startsWith("Bukti harus")) {
        console.error("saveEvidence AI gagal", e);
      }
      return null;
    }
  }

  const shots = (form?.getAll("screenshots") ?? []).filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  for (const [i, file] of shots.slice(0, MAX_SHOTS).entries()) {
    const path = await store(file, `Screenshot langkah ${i + 1}`);
    if (path) gallery.push({ path, label: labels[i] || `Langkah ${i + 1}` });
  }

  // Kompatibilitas: bukti tunggal lama diperlakukan sebagai galeri satu entri.
  if (gallery.length === 0) {
    const evidence = form?.get("evidence");
    if (evidence instanceof File && evidence.size > 0) {
      const path = await store(evidence, "Screenshot AI");
      if (path) gallery.push({ path, label: "Screenshot hasil run" });
    }
  }
  const evidencePath = gallery.at(-1)?.path ?? null;

  const finalNotes =
    [notes, warnings.length ? `Catatan sistem: ${warnings.join(" ")}` : null]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000) || null;

  const isError = outcome === "error";
  const updated = await queryOne<{ id: number }>(
    `UPDATE ai_test_runs
        SET status=$1,
            result=$2,
            severity=$3,
            notes=$4,
            error=$5,
            evidence_path=coalesce($6, evidence_path),
            evidence_gallery=$7::jsonb,
            runner_log=$8,
            login_credentials_enc=NULL,
            finished_at=now(),
            updated_at=now()
      WHERE id=$9 AND status='running'
      RETURNING id`,
    [
      isError ? "error" : "completed",
      isError ? null : outcome,
      severity,
      finalNotes,
      error,
      evidencePath,
      gallery.length ? JSON.stringify(gallery) : null,
      runnerLog,
      id,
    ],
  );
  if (!updated) return err("AI run sudah diproses runner lain.", 409);

  return NextResponse.json({ ok: true });
}
