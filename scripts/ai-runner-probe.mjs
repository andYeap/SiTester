// Probe HTTP deterministik untuk kategori AI non-fungsional (tanpa model/browser).
// Dipisah dari ai-runner.mjs agar bisa diuji tanpa kredensial runner.

export async function probeOnce(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "SITester-AI-Runner/1.0" },
    });
    try {
      await res.body?.cancel();
    } catch {
      /* abaikan body */
    }
    return {
      ok: true,
      status: res.status,
      ms: Date.now() - started,
      headers: res.headers,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function summarizeProbe(results) {
  const total = results.length;
  const bad = results.filter((r) => !r.ok || r.status >= 500).length;
  const lat = results
    .filter((r) => r.ok)
    .map((r) => r.ms)
    .sort((a, b) => a - b);
  const p95 = lat.length
    ? lat[Math.min(lat.length - 1, Math.ceil(lat.length * 0.95) - 1)]
    : 0;
  const avg = lat.length
    ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)
    : 0;
  return { total, bad, errorRate: total ? bad / total : 1, p95, avg };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runProbe(run) {
  const category = run.category ?? "fungsional";
  const baseLog = `[run ${run.id}] kategori=${category}\ntarget=${run.target_url}\n`;

  if (category === "keamanan") {
    const url = new URL(run.target_url);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const res = await probeOnce(run.target_url);
    if (!res.ok) {
      return {
        outcome: "error",
        error: `Probe keamanan gagal terhubung: ${res.error}`,
        notes: `Keamanan dasar: ${run.goal}`,
        log: `${baseLog}error=${res.error}`,
      };
    }
    const h = res.headers;
    const checks = [
      {
        name: "HTTPS",
        ok: localHost || url.protocol === "https:",
        detail: url.protocol,
      },
      { name: "Respons < 400", ok: res.status < 400, detail: `HTTP ${res.status}` },
      {
        name: "X-Content-Type-Options: nosniff",
        ok: (h.get("x-content-type-options") ?? "").toLowerCase().includes("nosniff"),
        detail: h.get("x-content-type-options") ?? "tidak ada",
      },
      {
        name: "Proteksi framing (X-Frame-Options / CSP frame-ancestors)",
        ok:
          Boolean(h.get("x-frame-options")) ||
          (h.get("content-security-policy") ?? "").includes("frame-ancestors"),
        detail:
          h.get("x-frame-options") ??
          (h.get("content-security-policy") ?? "tidak ada"),
      },
    ];
    if (url.protocol === "https:") {
      checks.push({
        name: "Strict-Transport-Security",
        ok: Boolean(h.get("strict-transport-security")),
        detail: h.get("strict-transport-security") ?? "tidak ada",
      });
    }
    const passed = checks.every((c) => c.ok);
    const lines = checks.map((c) => `${c.ok ? "OK" : "GAGAL"} ${c.name}: ${c.detail}`);
    return {
      outcome: passed ? "pass" : "fail",
      severity: passed ? null : "medium",
      notes: `Keamanan dasar: ${checks.filter((c) => c.ok).length}/${checks.length} pemeriksaan lolos.\n${lines.join("\n")}`,
      log: `${baseLog}status=${res.status} latency=${res.ms}ms\n${lines.join("\n")}`,
    };
  }

  if (category === "ketahanan") {
    const seconds = Math.max(
      5,
      Number(process.env.AI_ENDURANCE_SECONDS ?? 30) || 30,
    );
    const intervalMs = 500;
    const total = Math.max(1, Math.ceil((seconds * 1000) / intervalMs));
    const results = [];
    let consecutive = 0;
    let maxConsecutive = 0;
    for (let i = 0; i < total; i++) {
      const r = await probeOnce(run.target_url);
      results.push(r);
      const bad = !r.ok || r.status >= 500;
      consecutive = bad ? consecutive + 1 : 0;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
      if (i < total - 1) await sleep(intervalMs);
    }
    const s = summarizeProbe(results);
    const passed =
      s.errorRate <= 0.05 && s.p95 <= 5000 && maxConsecutive <= 3;
    return {
      outcome: passed ? "pass" : "fail",
      severity: passed ? null : "medium",
      notes: `Ketahanan ${seconds}s: ${s.total - s.bad}/${s.total} permintaan sehat, rata-rata ${s.avg}ms, p95 ${s.p95}ms, gagal beruntun maks ${maxConsecutive}.\nTujuan: ${run.goal}`,
      log: `${baseLog}durasi=${seconds}s total=${s.total} gagal=${s.bad} error_rate=${(s.errorRate * 100).toFixed(1)}% avg=${s.avg}ms p95=${s.p95}ms max_consecutive=${maxConsecutive}`,
    };
  }

  // stress
  const requests = Math.max(
    10,
    Number(process.env.AI_STRESS_REQUESTS ?? 60) || 60,
  );
  const concurrency = Math.max(
    2,
    Math.min(50, Number(process.env.AI_STRESS_CONCURRENCY ?? 10) || 10),
  );
  const results = [];
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= requests) return;
      results.push(await probeOnce(run.target_url));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const s = summarizeProbe(results);
  const passed = s.errorRate <= 0.05 && s.p95 <= 5000;
  return {
    outcome: passed ? "pass" : "fail",
    severity: passed ? null : "medium",
    notes: `Stress ${requests} permintaan / konkurensi ${concurrency}: ${s.total - s.bad}/${s.total} sehat, rata-rata ${s.avg}ms, p95 ${s.p95}ms, error ${(s.errorRate * 100).toFixed(1)}%.\nTujuan: ${run.goal}`,
    log: `${baseLog}permintaan=${requests} konkurensi=${concurrency} gagal=${s.bad} error_rate=${(s.errorRate * 100).toFixed(1)}% avg=${s.avg}ms p95=${s.p95}ms`,
  };
}
