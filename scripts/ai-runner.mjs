#!/usr/bin/env node
// Runner eksternal untuk AI Test SITester.
// Jalankan di VPS/laptop: SITESTER_URL, AI_RUNNER_TOKEN, OPENROUTER_API_KEY.
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const API = (process.env.SITESTER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.AI_RUNNER_TOKEN ?? "";
const MODEL = process.env.E2E_MODEL ?? "nvidia/nemotron-3.5-super-vl:free";
const RUNNER_ID =
  process.env.AI_RUNNER_ID ?? `runner-${process.pid}-${Date.now()}`;
const ONCE = process.argv.includes("--once");
const TARGET_EMAIL = process.env.AI_TARGET_EMAIL ?? "";
const TARGET_PASSWORD = process.env.AI_TARGET_PASSWORD ?? "";

if (!TOKEN || TOKEN.length < 20) {
  console.error("AI_RUNNER_TOKEN wajib diisi (minimal 20 karakter).");
  process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY wajib diisi untuk agent step.");
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers ?? {}),
    },
  });
  return res;
}

function q(value) {
  return JSON.stringify(String(value));
}

function buildConfig(run) {
  const credentials =
    TARGET_EMAIL && TARGET_PASSWORD
      ? `credentials: { target: { username: process.env.AI_TARGET_EMAIL, password: process.env.AI_TARGET_PASSWORD } },`
      : "";
  return `import { web } from "@e2e-dev/web";
import { openrouter } from "@openrouter/ai-sdk-provider";

export default {
  tests: ["tests/**/*.e2e.ts"],
  output: ".e2e",
  targets: [{ name: "target", engine: web({ viewport: { width: 1440, height: 900 } }), app: { url: ${q(run.target_url)} } }],
  agents: { default: { model: openrouter(${q(MODEL)}) } },
  ${credentials}
  timeout: 180_000,
  workers: 1,
  reporters: ["list", "junit"],
};
`;
}

function buildTest(run, targetPath) {
  const login = TARGET_EMAIL && TARGET_PASSWORD
    ? `  {
    const target = credentials.user("target");
    await agent.act("login ke aplikasi dengan email {email} dan password {password}", {
      params: { email: target.username, password: target.password },
    });
  }`
    : "";
  return `import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("SITester AI run ${run.id}", async ({ app, agent }) => {
  await app.open(${q(targetPath || "/")});
${login}
  await agent.act(${q(run.goal)});
  await agent.assert(${q(run.success_criteria || "tujuan pengujian tercapai")});
  await app.screenshot("hasil-ai");
});
`;
}

function runE2e(configPath, dir) {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["e2e", "run", "--config", configPath],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          E2E_TELEMETRY_DISABLED: "1",
          AI_TARGET_EMAIL: TARGET_EMAIL,
          AI_TARGET_PASSWORD: TARGET_PASSWORD,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (d) => { output += d.toString(); });
    child.stderr.on("data", (d) => { output += d.toString(); });
    child.on("close", (code) => resolve({ code, output, dir }));
  });
}

function collectScreenshots(report) {
  const paths = [];
  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) return obj.forEach(walk);
    if (obj.kind === "screenshot" && typeof obj.path === "string") {
      paths.push(obj.path);
    }
    Object.values(obj).forEach(walk);
  };
  walk(report?.run?.results ?? []);
  return paths;
}

async function findScreenshot(outputDir, report) {
  const candidates = collectScreenshots(report);
  const bases = [
    join(outputDir, "results"),
    outputDir,
    join(process.cwd(), ".e2e", "results"),
  ];
  for (const candidate of candidates) {
    for (const base of bases) {
      const full = join(base, candidate);
      try {
        return await readFile(full);
      } catch {
        /* lanjut */
      }
    }
  }
  // Fallback: screenshot pertama di results.
  for (const base of bases) {
    try {
      const stack = [base];
      while (stack.length) {
        const current = stack.pop();
        const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const full = join(current, entry.name);
          if (entry.isDirectory()) stack.push(full);
          else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) return await readFile(full);
        }
      }
    } catch {
      /* lanjut */
    }
  }
  return null;
}

async function uploadResult(id, data, screenshot) {
  const form = new FormData();
  form.set("outcome", data.outcome);
  if (data.notes) form.set("notes", data.notes.slice(0, 4000));
  if (data.error) form.set("error", data.error.slice(0, 4000));
  if (data.severity) form.set("severity", data.severity);
  if (screenshot) {
    form.set(
      "evidence",
      new File([screenshot], "hasil-ai.png", { type: "image/png" }),
    );
  }
  const res = await api(`/api/v1/ai-runs/${id}/result`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload hasil gagal (HTTP ${res.status}): ${await res.text()}`);
  }
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return "/";
  }
}

function errorText(report) {
  const errors = report?.run?.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
      .join("\n")
      .slice(0, 4000);
  }
  const fails = [];
  for (const result of report?.run?.results ?? []) {
    if (result.status === "failed" || result.status === "interrupted") {
      for (const attempt of result.attempts ?? []) {
        for (const err of attempt.errors ?? []) {
          fails.push(typeof err === "string" ? err : JSON.stringify(err));
        }
      }
    }
  }
  return fails.join("\n").slice(0, 4000);
}

async function processRun(run) {
  const dir = join(".ai-runner", `run-${run.id}`);
  await mkdir(join(dir, "tests"), { recursive: true });
  const configPath = join(dir, "e2e.config.ts");
  await writeFile(configPath, buildConfig(run));
  await writeFile(join(dir, "tests", "ai.e2e.ts"), buildTest(run, pathOf(run.target_url)));

  console.log(`[run ${run.id}] mulai: ${run.target_url}`);
  const execution = await runE2e(configPath, dir);
  let report = null;
  try {
    report = JSON.parse(await readFile(join(dir, ".e2e", "report.json"), "utf8"));
  } catch {
    /* tidak ada report */
  }

  const passed =
    execution.code === 0 && report?.run?.status === "passed";
  const summary = report?.run?.summary ?? {};
  const errors = errorText(report);
  const notes = passed
    ? `AI: ${run.goal}${run.success_criteria ? ` — kriteria: ${run.success_criteria}` : ""} (${summary.executed ?? 0} test lulus)`
    : `AI: ${run.goal}${run.success_criteria ? ` — kriteria: ${run.success_criteria}` : ""}${errors ? `\nError: ${errors}` : ""}`;

  const screenshot = await findScreenshot(join(dir, ".e2e"), report);

  try {
    await uploadResult(run.id, {
      outcome: report ? (passed ? "pass" : "fail") : "error",
      notes,
      error: report ? errors || null : execution.output.slice(-4000),
      severity: passed ? null : "medium",
    }, screenshot);
    console.log(`[run ${run.id}] ${passed ? "PASS" : "FAIL"} dikirim`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function loop() {
  while (true) {
    let res;
    try {
      res = await api("/api/v1/ai-runs/next", {
        headers: { "X-Runner-Id": RUNNER_ID },
      });
    } catch (e) {
      console.error("Gagal menghubungi SITester:", e.message);
      if (ONCE) process.exit(1);
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }

    if (res.status === 204) {
      if (ONCE) {
        console.log("Tidak ada antrean.");
        return;
      }
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!res.ok) {
      console.error("Ambil antrean gagal:", res.status, await res.text());
      if (ONCE) process.exit(1);
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }

    const { run } = await res.json();
    try {
      await processRun(run);
    } catch (e) {
      console.error(`[run ${run.id}] error:`, e.message);
      await uploadResult(run.id, {
        outcome: "error",
        error: e.message,
      }, null).catch(() => undefined);
    }
    if (ONCE) return;
  }
}

await loop();
