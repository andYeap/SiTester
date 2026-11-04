import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as listRuns, POST as createRun } from "@/app/api/v1/ai-runs/route";
import { GET as getRun } from "@/app/api/v1/ai-runs/[id]/route";
import { GET as nextRun } from "@/app/api/v1/ai-runs/next/route";
import { POST as submitResult } from "@/app/api/v1/ai-runs/[id]/result/route";
import { POST as submitSession } from "@/app/api/v1/test-sessions/route";

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
      confirmed_session_id: number | null;
    }>(
      `SELECT status, result, evidence_path, confirmed_session_id
         FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(runRow[0].status).toBe("completed");
    expect(runRow[0].result).toBe("pass");
    expect(runRow[0].evidence_path).toBeTruthy();

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
});
