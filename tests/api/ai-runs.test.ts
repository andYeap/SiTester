import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as listRuns, POST as createRun } from "@/app/api/v1/ai-runs/route";
import { GET as getRun, PATCH as cancelRun, DELETE as deleteRun } from "@/app/api/v1/ai-runs/[id]/route";
import { GET as nextRun } from "@/app/api/v1/ai-runs/next/route";
import { POST as submitResult } from "@/app/api/v1/ai-runs/[id]/result/route";
import { POST as heartbeat } from "@/app/api/v1/ai-runs/[id]/heartbeat/route";
import { POST as submitSession } from "@/app/api/v1/test-sessions/route";
import { DELETE as deleteSession } from "@/app/api/v1/test-sessions/[id]/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";
import { todayString } from "@/lib/time";

const RUNNER_TOKEN = "test-runner-token-1234567890";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(() => {
  process.env.AI_RUNNER_TOKEN = RUNNER_TOKEN;
  // Simpan bukti ke disk lokal, bukan jalur produksi Vercel Blob.
  (process.env as unknown as Record<string, string>).NODE_ENV = "test";
});

beforeEach(async () => {
  await query(`DELETE FROM ai_test_runs`);
});

const json = (body: unknown) =>
  new Request("http://test/api/v1/ai-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function feature() {
  const rows = await query<{ id: number; name: string }>(
    `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id, name`,
    [`AI ${uid()}`],
  );
  return rows[0];
}

function runnerRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${RUNNER_TOKEN}`,
      "X-Runner-Id": "test-runner",
      ...(init.headers ?? {}),
    },
  });
}

describe("AI test runs", () => {
  it("antrean, klaim runner, hasil + bukti, lalu konfirmasi ke sesi", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const createRes = await createRun(
      json({
        target_url: "https://example.test/app",
        goal: "buka halaman login dan pastikan form tampil",
        success_criteria: "form email dan password terlihat",
        feature_id: f.id,
        tested_as_role: "tester",
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number };

    const unauth = await nextRun(new Request("http://test/api/v1/ai-runs/next"));
    expect(unauth.status).toBe(401);

    const claimedRes = await nextRun(
      runnerRequest("http://test/api/v1/ai-runs/next"),
    );
    expect(claimedRes.status).toBe(200);
    const claimed = (await claimedRes.json()) as { run: { id: number } };
    expect(claimed.run.id).toBe(created.id);

    const resultForm = new FormData();
    resultForm.set("outcome", "pass");
    resultForm.set("notes", "AI: form login tampil");
    resultForm.set("log", "[run] login selector tidak ditemukan: getByLabel('Email')");
    resultForm.set(
      "evidence",
      new File([PNG], "hasil.png", { type: "image/png" }),
    );
    const resultRes = await submitResult(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/result`, {
        method: "POST",
        body: resultForm,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(resultRes.status).toBe(200);

    const runRow = await query<{
      status: string;
      result: string;
      evidence_path: string;
      evidence_gallery: { path: string; label: string }[] | null;
      confirmed_session_id: number | null;
    }>(
      `SELECT status, result, evidence_path, evidence_gallery, confirmed_session_id
         FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(runRow[0].status).toBe("completed");
    expect(runRow[0].result).toBe("pass");
    expect(runRow[0].evidence_path).toBeTruthy();
    expect(runRow[0].evidence_gallery).toHaveLength(1);
    expect(runRow[0].evidence_gallery?.[0].label).toBe("Screenshot hasil run");

    const listRes = await listRuns();
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as {
      runs: { id: number; has_log: boolean }[];
    };
    expect(list.runs.find((r) => r.id === created.id)?.has_log).toBe(true);

    const detailRes = await getRun(
      new Request(`http://test/api/v1/ai-runs/${created.id}`),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      run: { runner_log: string | null };
    };
    expect(detail.run.runner_log).toContain("getByLabel('Email')");

    const form = new FormData();
    form.set("tested_at", todayString());
    form.set("feature_id", String(f.id));
    form.set("is_retest", "0");
    form.set("tested_as_role", "tester");
    form.set("result", "pass");
    form.set("notes", "Dikonfirmasi dari AI run");
    form.set("ai_run_id", String(created.id));
    const sessionRes = await submitSession(
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        body: form,
      }),
    );
    expect(sessionRes.status).toBe(201);

    const confirmed = await query<{
      confirmed_session_id: number | null;
      evidence_path: string;
    }>(
      `SELECT confirmed_session_id, evidence_path FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(confirmed[0].confirmed_session_id).toBeTruthy();

    const session = await query<{ evidence_path: string | null }>(
      `SELECT evidence_path FROM test_sessions WHERE id=$1`,
      [confirmed[0].confirmed_session_id],
    );
    expect(session[0].evidence_path).toBe(confirmed[0].evidence_path);

    // Konfirmasi kedua ditolak.
    const again = await submitSession(
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        body: form,
      }),
    );
    expect(again.status).toBe(422);
  });

  it("kategori non-fungsional tersimpan, tervalidasi, dan dikirim ke runner", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const base = {
      target_url: "https://example.test/app",
      goal: "pastikan halaman tahan beban",
      feature_id: f.id,
      tested_as_role: "tester",
    };

    let res: Response = await createRun(json({ ...base, category: "aksesibilitas" }));
    expect(res.status).toBe(422);

    res = await createRun(json({ ...base, category: "stress" }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: number };

    const list = (await (await listRuns()).json()) as {
      runs: { id: number; category: string }[];
    };
    expect(list.runs.find((r) => r.id === created.id)?.category).toBe("stress");

    const claimed = (await (
      await nextRun(runnerRequest("http://test/api/v1/ai-runs/next"))
    ).json()) as { run: { id: number; category: string } };
    expect(claimed.run.id).toBe(created.id);
    expect(claimed.run.category).toBe("stress");
  });

  it("menyimpan galeri screenshot berurutan dan memakai gambar terakhir sebagai bukti", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const createRes = await createRun(
      json({
        target_url: "https://example.test/app",
        goal: "login lalu buka dashboard",
        feature_id: f.id,
        tested_as_role: "tester",
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number };
    await nextRun(runnerRequest("http://test/api/v1/ai-runs/next"));

    const form = new FormData();
    form.set("outcome", "pass");
    form.append("screenshots", new File([PNG], "1.png", { type: "image/png" }));
    form.append("screenshots", new File([PNG], "2.png", { type: "image/png" }));
    form.set(
      "screenshot_labels",
      JSON.stringify(["1. agent.act — login", "3. agent.assert — dashboard tampil"]),
    );
    const res = await submitResult(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/result`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(res.status).toBe(200);

    const rows = await query<{
      evidence_path: string | null;
      evidence_gallery: { path: string; label: string }[] | null;
    }>(
      `SELECT evidence_path, evidence_gallery FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(rows[0].evidence_gallery).toHaveLength(2);
    expect(rows[0].evidence_gallery?.[0].label).toBe("1. agent.act — login");
    expect(rows[0].evidence_gallery?.[1].label).toBe("3. agent.assert — dashboard tampil");
    expect(rows[0].evidence_path).toBe(rows[0].evidence_gallery?.[1].path);

    const detailRes = await getRun(
      new Request(`http://test/api/v1/ai-runs/${created.id}`),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      run: { evidence_gallery: { label: string }[] | null };
    };
    expect(detail.run.evidence_gallery).toHaveLength(2);
    expect(detail.run.evidence_gallery?.[1].label).toBe("3. agent.assert — dashboard tampil");
  });

  it("melewati screenshot lebih dari 2MB tanpa menggagalkan hasil", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);
    const createRes = await createRun(
      json({ target_url: "https://example.test/app", goal: "buka dashboard", feature_id: f.id, tested_as_role: "tester" }),
    );
    const created = (await createRes.json()) as { id: number };
    await nextRun(runnerRequest("http://test/api/v1/ai-runs/next"));

    const form = new FormData();
    form.set("outcome", "pass");
    form.append("screenshots", new File([Buffer.alloc(2 * 1024 * 1024 + 1)], "besar.png", { type: "image/png" }));
    form.append("screenshots", new File([PNG], "kecil.png", { type: "image/png" }));
    const res = await submitResult(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/result`, { method: "POST", body: form }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(res.status).toBe(200);

    const rows = await query<{ notes: string; evidence_gallery: unknown[] | null }>(
      `SELECT notes, evidence_gallery FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(rows[0].evidence_gallery).toHaveLength(1);
    expect(rows[0].notes).toContain("lebih dari 2MB");
  });

  it("login target per-run: kredensial terenkripsi, dikirim ke runner, lalu dihapus", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const createRes = await createRun(
      json({
        target_url: "https://example.test/app",
        goal: "buka dashboard dan pastikan tabel tampil",
        success_criteria: "tabel terlihat",
        feature_id: f.id,
        tested_as_role: "tester",
        use_login: true,
        login_url: "https://example.test/login",
        login_email: "target@example.test",
        login_password: "rahasia-target-123",
        login_email_label: "Email",
        login_password_label: "Kata sandi",
        login_submit_label: "Masuk",
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number };

    const stored = await query<{ enc: string | null }>(
      `SELECT login_credentials_enc AS enc FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(stored[0].enc).toBeTruthy();
    expect(stored[0].enc).not.toContain("target@example.test");
    expect(stored[0].enc).not.toContain("rahasia-target-123");

    const claimedRes = await nextRun(
      runnerRequest("http://test/api/v1/ai-runs/next"),
    );
    expect(claimedRes.status).toBe(200);
    const claimed = (await claimedRes.json()) as {
      run: {
        id: number;
        use_login: boolean;
        login_email: string;
        login_password: string;
        login_credentials_enc?: string;
      };
    };
    expect(claimed.run.id).toBe(created.id);
    expect(claimed.run.use_login).toBe(true);
    expect(claimed.run.login_email).toBe("target@example.test");
    expect(claimed.run.login_password).toBe("rahasia-target-123");
    expect(claimed.run.login_credentials_enc).toBeUndefined();

    const listRes = await listRuns();
    const list = (await listRes.json()) as {
      runs: { id: number; login_email?: string; login_password?: string }[];
    };
    expect(list.runs.find((r) => r.id === created.id)?.login_email).toBeUndefined();

    const resultForm = new FormData();
    resultForm.set("outcome", "pass");
    resultForm.set("notes", "login berhasil");
    const resultRes = await submitResult(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/result`, {
        method: "POST",
        body: resultForm,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(resultRes.status).toBe(200);

    const wiped = await query<{ enc: string | null }>(
      `SELECT login_credentials_enc AS enc FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(wiped[0].enc).toBeNull();
  });

  it("validasi URL target dan token runner salah", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const bad = await createRun(
      json({
        target_url: "javascript:alert(1)",
        goal: "buka halaman",
        feature_id: f.id,
        tested_as_role: "tester",
      }),
    );
    expect(bad.status).toBe(422);

    const wrong = await nextRun(
      new Request("http://test/api/v1/ai-runs/next", {
        headers: { Authorization: "Bearer token-salah" },
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it("kuota MAX_PENDING tahan terhadap pembuatan bersamaan", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createRun(
          json({
            target_url: "https://example.test/app",
            goal: `uji konkuren ${i} pastikan antrean`,
            feature_id: f.id,
            tested_as_role: "tester",
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 422)).toHaveLength(2);
  });

  it("heartbeat memperbarui lease run yang berjalan", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await feature();
    await loginAs(tester.email);

    const created = (await (
      await createRun(
        json({
          target_url: "https://example.test/app",
          goal: "uji heartbeat run",
          feature_id: f.id,
          tested_as_role: "tester",
        }),
      )
    ).json()) as { id: number };

    const hbQueued = await heartbeat(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/heartbeat`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(hbQueued.status).toBe(404);

    const claimed = await nextRun(
      runnerRequest("http://test/api/v1/ai-runs/next"),
    );
    expect(claimed.status).toBe(200);

    const hb = await heartbeat(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/heartbeat`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(hb.status).toBe(204);

    const unauth = await heartbeat(
      new Request(`http://test/api/v1/ai-runs/${created.id}/heartbeat`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(unauth.status).toBe(401);
  });

  it("hasil AI hanya boleh dikonfirmasi untuk fitur yang sama", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f1 = await feature();
    const f2 = await feature();
    await loginAs(tester.email);

    const run = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (created_by, target_url, goal, feature_id, tested_as_role, status, result)
       VALUES ($1,'https://example.test','uji',$2,'tester','completed','pass')
       RETURNING id`,
      [tester.id, f1.id],
    );

    const form = new FormData();
    form.set("tested_at", todayString());
    form.set("feature_id", String(f2.id));
    form.set("is_retest", "0");
    form.set("tested_as_role", "tester");
    form.set("result", "pass");
    form.set("ai_run_id", String(run[0].id));
    const res = await submitSession(
      new Request("http://test/api/v1/test-sessions", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe("batalkan AI run yang antre", () => {
  it("pemilik dapat membatalkan run queued", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const featureId = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role)
       VALUES ('https://contoh.test','Antre',$1,$2,'queued','tester') RETURNING id`,
      [featureId.id, user.id],
    );
    const id = rows[0].id;

    const noBody = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${id}`, { method: "PATCH", body: "{}" }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    expect(noBody.status).toBe(422);

    const ok = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    expect(ok.status).toBe(200);
    const after = await query<{ status: string; finished_at: string | null }>(
      `SELECT status, finished_at::text AS finished_at FROM ai_test_runs WHERE id=$1`,
      [id],
    );
    expect(after[0].status).toBe("cancelled");
    expect(after[0].finished_at).not.toBeNull();
  });

  it("run yang sudah selesai tidak bisa dibatalkan", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const featureId = await feature();
    const run = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role)
       VALUES ('https://contoh.test','Selesai',$1,$2,'completed','tester') RETURNING id`,
      [featureId.id, user.id],
    );
    const res = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${run[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: Promise.resolve({ id: String(run[0].id) }) },
    );
    expect(res.status).toBe(422);
  });

  it("pengguna lain tidak bisa membatalkan run orang lain", async () => {
    await resetDb();
    const owner = await createUser();
    const other = await createUser();
    const featureId = await feature();
    const run = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role)
       VALUES ('https://contoh.test','Antre',$1,$2,'queued','tester') RETURNING id`,
      [featureId.id, owner.id],
    );
    await loginAs(other.email);
    const res = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${run[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      { params: Promise.resolve({ id: String(run[0].id) }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("tolak dan hapus AI run", () => {
  const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

  it("pemilik dapat menolak hasil yang belum dikonfirmasi", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const f = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role, result)
       VALUES ('https://contoh.test','Hasil',$1,$2,'completed','tester','pass')
       RETURNING id`,
      [f.id, user.id],
    );
    const id = rows[0].id;

    const res = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      }),
      params(id),
    );
    expect(res.status).toBe(200);
    const after = await query<{ status: string }>(
      `SELECT status FROM ai_test_runs WHERE id=$1`,
      [id],
    );
    expect(after[0].status).toBe("rejected");
  });

  it("hasil yang sudah dikonfirmasi tidak bisa ditolak", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const f = await feature();
    const sessions = await query<{ id: number }>(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result)
       VALUES ($1,$2,current_date,'pass') RETURNING id`,
      [user.id, f.id],
    );
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role,
         result, confirmed_session_id)
       VALUES ('https://contoh.test','Hasil',$1,$2,'confirmed','tester','pass',$3)
       RETURNING id`,
      [f.id, user.id, sessions[0].id],
    );
    const res = await cancelRun(
      new Request(`http://test/api/v1/ai-runs/${rows[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      }),
      params(rows[0].id),
    );
    expect(res.status).toBe(422);
  });

  it("hapus satu run saja, dan run yang sedang berjalan ditolak", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const f = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role)
       VALUES ('https://contoh.test','A',$1,$2,'queued','tester'),
              ('https://contoh.test','B',$1,$2,'queued','tester'),
              ('https://contoh.test','C',$1,$2,'running','tester')
       RETURNING id`,
      [f.id, user.id],
    );
    const [first, second, running] = rows.map((r) => r.id);

    const ok = await deleteRun(
      new Request(`http://test/api/v1/ai-runs/${first}`, { method: "DELETE" }),
      params(first),
    );
    expect(ok.status).toBe(200);

    const left = await query<{ id: number }>(
      `SELECT id FROM ai_test_runs ORDER BY id`,
    );
    expect(left.map((r) => r.id)).toEqual([second, running]);

    const blocked = await deleteRun(
      new Request(`http://test/api/v1/ai-runs/${running}`, { method: "DELETE" }),
      params(running),
    );
    expect(blocked.status).toBe(409);
  });

  it("run terkonfirmasi hanya terhapus dengan force", async () => {
    await resetDb();
    const user = await createUser();
    await loginAs(user.email);
    const f = await feature();
    const sessions = await query<{ id: number }>(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result)
       VALUES ($1,$2,current_date,'pass') RETURNING id`,
      [user.id, f.id],
    );
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role,
         result, confirmed_session_id)
       VALUES ('https://contoh.test','Hasil',$1,$2,'confirmed','tester','pass',$3)
       RETURNING id`,
      [f.id, user.id, sessions[0].id],
    );
    const id = rows[0].id;

    const blocked = await deleteRun(
      new Request(`http://test/api/v1/ai-runs/${id}`, { method: "DELETE" }),
      params(id),
    );
    expect(blocked.status).toBe(409);

    const ok = await deleteRun(
      new Request(`http://test/api/v1/ai-runs/${id}?force=1`, { method: "DELETE" }),
      params(id),
    );
    expect(ok.status).toBe(200);

    const session = await query(`SELECT id FROM test_sessions WHERE id=$1`, [
      sessions[0].id,
    ]);
    expect(session).toHaveLength(1);
  });

  it("pengguna lain tidak bisa menghapus run orang lain", async () => {
    await resetDb();
    const owner = await createUser();
    const other = await createUser();
    const f = await feature();
    const rows = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role)
       VALUES ('https://contoh.test','A',$1,$2,'queued','tester') RETURNING id`,
      [f.id, owner.id],
    );
    await loginAs(other.email);
    const res = await deleteRun(
      new Request(`http://test/api/v1/ai-runs/${rows[0].id}`, { method: "DELETE" }),
      params(rows[0].id),
    );
    expect(res.status).toBe(404);
  });
});

describe("hapus riwayat konfirmasi AI", () => {
  it("mengembalikan run menjadi draft", async () => {
    await resetDb();
    const tester = await createUser();
    const ketua = await createUser(undefined, "ketua_tim");
    const f = await feature();
    const sessions = await query<{ id: number }>(
      `INSERT INTO test_sessions (user_id, feature_id, tested_at, result)
       VALUES ($1,$2,current_date,'pass') RETURNING id`,
      [tester.id, f.id],
    );
    const sessionId = sessions[0].id;
    const runs = await query<{ id: number }>(
      `INSERT INTO ai_test_runs
        (target_url, goal, feature_id, created_by, status, tested_as_role,
         confirmed_session_id, result)
       VALUES ('https://contoh.test','uji',$1,$2,'confirmed','tester',$3,'pass')
       RETURNING id`,
      [f.id, tester.id, sessionId],
    );

    await loginAs(ketua.email);
    const params = { params: Promise.resolve({ id: String(sessionId) }) };
    const blocked = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1", { method: "DELETE" }),
      params,
    );
    expect(blocked.status).toBe(409);

    const ok = await deleteSession(
      new Request("http://test/api/v1/test-sessions/1?force=1", { method: "DELETE" }),
      params,
    );
    expect(ok.status).toBe(200);

    const after = await query<{
      status: string;
      confirmed_session_id: number | null;
    }>(
      `SELECT status, confirmed_session_id FROM ai_test_runs WHERE id=$1`,
      [runs[0].id],
    );
    expect(after[0]).toEqual({ status: "completed", confirmed_session_id: null });
  });
});
