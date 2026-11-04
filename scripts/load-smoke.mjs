// Smoke beban ringan: login lalu hantam endpoint dashboard paralel,
// laporkan p50/p95 dan pastikan tak ada error. Tanpa dependensi tambahan.
// Contoh: SITESTER_URL=http://localhost:3000 LOAD_EMAIL=tester1@testlab.test \
//   LOAD_PASSWORD=password CONCURRENCY=10 REQUESTS=100 node scripts/load-smoke.mjs
const BASE = (process.env.SITESTER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.LOAD_EMAIL ?? "tester1@testlab.test";
const PASSWORD = process.env.LOAD_PASSWORD ?? "password";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const REQUESTS = Number(process.env.REQUESTS ?? 100);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 5000);

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`login gagal (HTTP ${loginRes.status}); pastikan seed sudah jalan.`);
  process.exit(1);
}
const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] ?? "";
await fetch(`${BASE}/api/v1/dashboard/stats?range=30`, { headers: { cookie } }); // pemanasan

const latencies = [];
let errors = 0;
const started = Date.now();
for (let done = 0; done < REQUESTS; done += CONCURRENCY) {
  const batch = Array.from(
    { length: Math.min(CONCURRENCY, REQUESTS - done) },
    async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}/api/v1/dashboard/stats?range=30`, {
          headers: { cookie },
        });
        if (!res.ok) errors += 1;
        await res.arrayBuffer();
      } catch {
        errors += 1;
      }
      latencies.push(Date.now() - t0);
    },
  );
  await Promise.all(batch);
}
const totalMs = Date.now() - started;
latencies.sort((a, b) => a - b);
const p50 = quantile(latencies, 0.5);
const p95 = quantile(latencies, 0.95);
console.log(
  `load-smoke: ${REQUESTS} req / concurrency ${CONCURRENCY} / ${(REQUESTS / (totalMs / 1000)).toFixed(1)} rps`,
);
console.log(`latensi ms: p50=${p50} p95=${p95} max=${latencies[latencies.length - 1]}`);
console.log(`error: ${errors}`);
await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie } }).catch(() => undefined);

if (errors > 0 || p95 > P95_BUDGET_MS) {
  console.error("load-smoke GAGAL: ada error atau p95 melebihi budget.");
  process.exit(1);
}
console.log("load-smoke OK");
