import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as createRun } from "@/app/api/v1/ai-runs/route";
import { POST as submitResult } from "@/app/api/v1/ai-runs/[id]/result/route";
import { POST as submitSession } from "@/app/api/v1/test-sessions/route";

import { createUser, loginAs, resetDb, uid } from "./helpers";
import { query } from "@/lib/db";
import { todayString } from "@/lib/time";

const RUNNER_TOKEN = "test-runner-token-1234567890";

beforeAll(() => {
  process.env.AI_RUNNER_TOKEN = RUNNER_TOKEN;
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

describe("AI provider error bukan defect", () => {
  it("outcome error -> status error, tidak bisa dikonfirmasi", async () => {
    await resetDb();
    const tester = await createUser(undefined, "tester");
    const f = await query<{ id: number }>(
      `INSERT INTO features (name, is_active, verified) VALUES ($1,true,true) RETURNING id`,
      [`AI err ${uid()}`],
    );
    await loginAs(tester.email);

    const createRes = await createRun(
      json({
        target_url: "https://example.test/app",
        goal: "uji login",
        feature_id: f[0].id,
        tested_as_role: "tester",
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number };

    // Klaim agar status running
    const { GET: nextRun } = await import("@/app/api/v1/ai-runs/next/route");
    const claimed = await nextRun(runnerRequest("http://test/api/v1/ai-runs/next"));
    expect(claimed.status).toBe(200);

    const form = new FormData();
    form.set("outcome", "error");
    form.set("error", "MODEL_PROVIDER_FAILED: model overloaded");
    form.set("log", "provider high demand");
    const res = await submitResult(
      runnerRequest(`http://test/api/v1/ai-runs/${created.id}/result`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(res.status).toBe(200);

    const row = await query<{ status: string; result: string | null }>(
      `SELECT status, result FROM ai_test_runs WHERE id=$1`,
      [created.id],
    );
    expect(row[0].status).toBe("error");
    expect(row[0].result).toBeNull();

    // Konfirmasi harus ditolak
    const sform = new FormData();
    sform.set("tested_at", todayString());
    sform.set("feature_id", String(f[0].id));
    sform.set("is_retest", "0");
    sform.set("tested_as_role", "tester");
    sform.set("result", "pass");
    sform.set("ai_run_id", String(created.id));
    const sres = await submitSession(
      new Request("http://test/api/v1/test-sessions", { method: "POST", body: sform }),
    );
    expect(sres.status).toBe(422);
  });
});
