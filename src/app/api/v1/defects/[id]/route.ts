import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

const STATUSES = ["open", "fixed", "verified", "closed", "reopened"];

const TRANSITIONS: Record<string, string[]> = {
  open: ["fixed"],
  reopened: ["fixed"],
  fixed: ["verified", "reopened"],
  verified: ["closed", "reopened"],
  closed: ["reopened"],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);
  const id = parsePositiveInt((await params).id);
  if (id === null) return err("Defect tidak ditemukan.", 404);

  const existing = await queryOne<{
    id: number;
    status: string;
    feature_id: number;
    title: string;
    created_by: string;
  }>(`SELECT id, status, feature_id, title, created_by FROM defects WHERE id=$1`, [id]);
  if (!existing) return err("Defect tidak ditemukan.", 404);
  if (user.role !== "ketua_tim" && existing.created_by !== user.id) {
    return err("Forbidden", 403);
  }

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    assignee?: unknown;
    fix_reference?: unknown;
    note?: unknown;
  } | null;

  const status =
    typeof body?.status === "string" ? body.status : existing.status;
  if (!STATUSES.includes(status)) {
    return err("Status defect tidak valid.", 422);
  }
  if (
    status !== existing.status &&
    !(TRANSITIONS[existing.status] ?? []).includes(status)
  ) {
    return err(
      `Transisi status ${existing.status} → ${status} tidak diizinkan.`,
      422,
    );
  }
  if (status === "verified" && user.role !== "ketua_tim") {
    return err("Hanya ketua tim yang dapat memverifikasi defect.", 403);
  }

  const assignee =
    typeof body?.assignee === "string" && body.assignee.trim() !== ""
      ? body.assignee.trim().slice(0, 255)
      : null;
  const fixReference =
    typeof body?.fix_reference === "string" && body.fix_reference.trim() !== ""
      ? body.fix_reference.trim().slice(0, 1000)
      : null;
  const note =
    typeof body?.note === "string" && body.note.trim() !== ""
      ? body.note.trim().slice(0, 2000)
      : null;

  await queryOne(
    `UPDATE defects
        SET status=$1,
            assignee=coalesce($2, assignee),
            fix_reference=coalesce($3, fix_reference),
            note=coalesce($4, note),
            verified_by=CASE WHEN $1='verified' THEN $5::uuid ELSE verified_by END,
            verified_at=CASE WHEN $1='verified' THEN now() ELSE verified_at END,
            updated_at=now()
      WHERE id=$6 RETURNING id`,
    [status, assignee, fixReference, note, user.id, id],
  );

  await audit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "defects.update",
    target: existing.title,
    changes: { from: existing.status, to: status, assignee, fix_reference: fixReference },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}
