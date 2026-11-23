import type { AddressInfo } from "node:net";
import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { runProbe, summarizeProbe } from "../../scripts/ai-runner-probe.mjs";

async function withServer(
  headers: Record<string, string>,
  run: (url: string) => Promise<void>,
) {
  const s = createServer((_req, res) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end("ok");
  });
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const { port } = s.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}/`);
  } finally {
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
}

describe("summarizeProbe", () => {
  it("menghitung error rate dan p95", () => {
    const s = summarizeProbe([
      { ok: true, status: 200, ms: 100 },
      { ok: true, status: 200, ms: 200 },
      { ok: false, status: 0, ms: 300 },
    ]);
    expect(s.total).toBe(3);
    expect(s.bad).toBe(1);
    expect(s.errorRate).toBeCloseTo(1 / 3);
    expect(s.p95).toBe(200);
  });
});

describe("runProbe", () => {
  it("keamanan lolos saat header dasar lengkap", async () => {
    await withServer(
      {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      },
      async (url) => {
        const r = await runProbe({ id: 1, goal: "cek", target_url: url, category: "keamanan" });
        expect(r.outcome).toBe("pass");
      },
    );
  });

  it("keamanan gagal tanpa header dasar", async () => {
    await withServer({}, async (url) => {
      const r = await runProbe({ id: 2, goal: "cek", target_url: url, category: "keamanan" });
      expect(r.outcome).toBe("fail");
      expect(r.severity).toBe("medium");
    });
  });

  it("stress lolos untuk server sehat", async () => {
    process.env.AI_STRESS_REQUESTS = "10";
    process.env.AI_STRESS_CONCURRENCY = "2";
    try {
      await withServer({}, async (url) => {
        const r = await runProbe({ id: 3, goal: "cek", target_url: url, category: "stress" });
        expect(r.outcome).toBe("pass");
      });
    } finally {
      delete process.env.AI_STRESS_REQUESTS;
      delete process.env.AI_STRESS_CONCURRENCY;
    }
  });
});
