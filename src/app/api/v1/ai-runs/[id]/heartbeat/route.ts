import { err } from "@/lib/api";
import { query } from "@/lib/db";
import {
  isRunnerAuthorized,
  runnerId,
  runnerUnauthorized,
} from "@/lib/runner-auth";
import { parsePositiveInt } from "@/lib/validation";
import { NextResponse } from "next/server";

/** Runner memperbarui lease run yang sedang dikerjakan agar tidak di-reclaim. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isRunnerAuthorized(request)) return runnerUnauthorized();
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("AI run tidak valid.", 422);

  const rows = await query<{ id: number }>(
    `UPDATE ai_test_runs
        SET claimed_at=now(), updated_at=now(), runner_id=$2
      WHERE id=$1 AND status='running'
      RETURNING id`,
    [id, runnerId(request)],
  );
  if (rows.length === 0) {
    return err("AI run tidak sedang berjalan.", 404);
  }
  return new NextResponse(null, { status: 204 });
}
