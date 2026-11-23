import { beforeEach, describe, expect, it } from "vitest";

import { DELETE as deleteNotif } from "@/app/api/v1/notifications/route";
import {
  DELETE as deleteSession,
  PATCH as patchSession,
} from "@/app/api/v1/test-sessions/[id]/route";
import { DELETE as deleteDefect } from "@/app/api/v1/defects/[id]/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";

beforeEach(async () => {
  await resetDb();
});

async function feature() {
  const rows = await query<{ id: number }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
    [`CRUD ${uid()}`],
  );
  return rows[0].id;
}

async function makeSession(userId: string, featureId: number, approvalId?: number) {
  const rows = await query<{ id: number }>(
    `INSERT INTO test_sessions
       (user_id, feature_id, tested_at, result, tested_as_role, retest_approval_id)
     VALUES ($1,$2,current_date,'pass','tester',$3) RETURNING id`,
    [userId, featureId, approvalId ?? null],
  );
  return rows[0].id;
}

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

describe("hapus notifikasi", () => {
  it("hanya pemilik notifikasi yang bisa menghapus", async () => {
    const owner = await createUser();
    const other = await createUser();
    const rows = await query<{ id: number }>(
      `INSERT INTO notifications (user_id, type, title) VALUES ($1,'info','Uji') RETURNING id`,
      [owner.id],
    );
    const id = rows[0].id;

    await loginAs(other.email);
    const denied = await deleteNotif(
      new Request(`http://test/api/v1/notifications?id=${id}`, { method: "DELETE" }),
    );
    expect(denied.status).toBe(404);

    await loginAs(owner.email);
    const ok = await deleteNotif(
      new Request(`http://test/api/v1/notifications?id=${id}`, { method: "DELETE" }),
    );
    expect(ok.status).toBe(200);
    const left = await query(`SELECT id FROM notifications WHERE id=$1`, [id]);
    expect(left).toHaveLength(0);
  });

  it("hapus semua hanya menghapus notifikasi milik sendiri", async () => {
    const owner = await createUser();
    const other = await createUser();
    await query(
      `INSERT INTO notifications (user_id, type, title)
       VALUES ($1,'info','A'), ($1,'info','B'), ($2,'info','C')`,
      [owner.id, other.id],
    );

    await loginAs(owner.email);
    const res = await deleteNotif(
      new Request("http://test/api/v1/notifications?all=1", { method: "DELETE" }),
    );
    expect(res.status).toBe(200);

    const own = await query(`SELECT id FROM notifications WHERE user_id=$1`, [owner.id]);
    const theirs = await query(`SELECT id FROM notifications WHERE user_id=$1`, [other.id]);
    expect(own).toHaveLength(0);
    expect(theirs).toHaveLength(1);
  });
});

describe("koreksi dan hapus riwayat", () => {
  it("tester tidak boleh mengoreksi, ketua boleh", async () => {
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const id = await makeSession(tester.id, fid);

    await loginAs(tester.email);
    const denied = await patchSession(
      new Request("http://test/api/v1/test-sessions/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "x" }),
      }),
      params(id),
    );
    expect(denied.status).toBe(403);

    await loginAs(ketua.email);
    const ok = await patchSession(
      new Request("http://test/api/v1/test-sessions/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "fail", severity: "high", notes: "salah catat" }),
      }),
      params(id),
    );
    expect(ok.status).toBe(200);

    const rows = await query<{ result: string; severity: string; notes: string }>(
      `SELECT result, severity, notes FROM test_sessions WHERE id=$1`,
      [id],
    );
    expect(rows[0]).toEqual({ result: "fail", severity: "high", notes: "salah catat" });

    const auditRows = await query(
      `SELECT id FROM audit_logs WHERE action='test_sessions.update' AND target=$1`,
      [`test_session#${id}`],
    );
    expect(auditRows).toHaveLength(1);
  });

  it("has pass tidak menyimpan severity", async () => {
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const id = await makeSession(tester.id, fid);
    await query(
      `UPDATE test_sessions SET result='fail', severity='high' WHERE id=$1`,
      [id],
    );

    await loginAs(ketua.email);
    await patchSession(
      new Request("http://test/api/v1/test-sessions/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "pass", severity: "high" }),
      }),
      params(id),
    );
    const rows = await query<{ severity: string | null }>(
      `SELECT severity FROM test_sessions WHERE id=$1`,
      [id],
    );
    expect(rows[0].severity).toBeNull();
  });

  it("ketua menghapus riwayat dan mengembalikan jatah retest", async () => {
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const approvals = await query<{ id: number }>(
      `INSERT INTO retest_approvals
         (feature_id, requested_by, approved_by, scope_role, test_cycle, expires_at, used_at)
       VALUES ($1,$2,$3,'tester',NULL,now() + interval '1 day',now()) RETURNING id`,
      [fid, tester.id, ketua.id],
    );
    const approvalId = approvals[0].id;
    const id = await makeSession(tester.id, fid, approvalId);

    await loginAs(tester.email);
    const denied = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1", { method: "DELETE" }),
      params(id),
    );
    expect(denied.status).toBe(403);

    await loginAs(ketua.email);
    const ok = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1", { method: "DELETE" }),
      params(id),
    );
    expect(ok.status).toBe(200);

    const left = await query(`SELECT id FROM test_sessions WHERE id=$1`, [id]);
    expect(left).toHaveLength(0);
    const approval = await query<{ used_at: string | null }>(
      `SELECT used_at::text AS used_at FROM retest_approvals WHERE id=$1`,
      [approvalId],
    );
    expect(approval[0].used_at).toBeNull();
    const auditRows = await query(
      `SELECT id FROM audit_logs WHERE action='test_sessions.delete' AND target=$1`,
      [`test_session#${id}`],
    );
    expect(auditRows).toHaveLength(1);
  });
  it("menghapus satu riwayat tidak menyentuh riwayat lain dan defect tetap ada", async () => {
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const keepId = await makeSession(tester.id, fid);
    const deleteId = await makeSession(tester.id, fid);
    const defects = await query<{ id: number }>(
      `INSERT INTO defects (feature_id, session_id, title, status, created_by)
       VALUES ($1,$2,'Tombol rusak','open',$3) RETURNING id`,
      [fid, deleteId, tester.id],
    );
    const defectId = defects[0].id;

    await loginAs(ketua.email);
    const blocked = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1", { method: "DELETE" }),
      params(deleteId),
    );
    expect(blocked.status).toBe(409);

    const ok = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1?force=1", { method: "DELETE" }),
      params(deleteId),
    );
    expect(ok.status).toBe(200);

    const sessions = await query<{ id: number }>(
      `SELECT id FROM test_sessions WHERE feature_id=$1 ORDER BY id`,
      [fid],
    );
    expect(sessions.map((s) => s.id)).toEqual([keepId]);
    const defect = await query<{ id: number; session_id: number | null }>(
      `SELECT id, session_id FROM defects WHERE id=$1`,
      [defectId],
    );
    expect(defect).toHaveLength(1);
    expect(defect[0].session_id).toBeNull();
  });

});

describe("hapus defect", () => {
  it("defect terverifikasi perlu konfirmasi force", async () => {
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO defects (feature_id, title, status)
       VALUES ($1,'Sudah diverifikasi','verified') RETURNING id`,
      [fid],
    );
    const id = rows[0].id;

    await loginAs(ketua.email);
    const blocked = await deleteDefect(
      new Request("http://test/api/v1/defects/1", { method: "DELETE" }),
      params(id),
    );
    expect(blocked.status).toBe(409);

    const ok = await deleteDefect(
      new Request("http://test/api/v1/defects/1?force=1", { method: "DELETE" }),
      params(id),
    );
    expect(ok.status).toBe(200);
    const left = await query(`SELECT id FROM defects WHERE id=$1`, [id]);
    expect(left).toHaveLength(0);
  });

  it("hanya ketua yang boleh menghapus", async () => {
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const fid = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO defects (feature_id, title, status, created_by)
       VALUES ($1,'Tombol rusak','open',$2) RETURNING id`,
      [fid, tester.id],
    );
    const id = rows[0].id;

    await loginAs(tester.email);
    const denied = await deleteDefect(
      new Request("http://test/api/v1/defects/1", { method: "DELETE" }),
      params(id),
    );
    expect(denied.status).toBe(403);

    await loginAs(ketua.email);
    const ok = await deleteDefect(
      new Request("http://test/api/v1/defects/1", { method: "DELETE" }),
      params(id),
    );
    expect(ok.status).toBe(200);
    const left = await query(`SELECT id FROM defects WHERE id=$1`, [id]);
    expect(left).toHaveLength(0);
  });
});
