import { existsSync } from "node:fs";

import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { google } from "@ai-sdk/google";
import { openrouter } from "@openrouter/ai-sdk-provider";

// Runner e2e tidak membaca .env sendiri; muat .env.local agar API key
// dan kredensial test tersedia tanpa perlu export manual.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const provider = process.env.E2E_PROVIDER ?? "openrouter";
// Model gratis + vision + tool calling.
// OpenRouter: nvidia/nemotron-3.5-super-vl:free (fallback gemma-4-31b-it:free)
// Google free tier: gemini-3.8-flash (alternatif kuota terpisah)
const modelId =
  process.env.E2E_MODEL ??
  (provider === "google"
    ? "gemini-3.8-flash"
    : "nvidia/nemotron-3.5-super-vl:free");
const model = provider === "google" ? google(modelId) : openrouter(modelId);
const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3200";

const config: E2EConfig = {
  targets: [
    {
      name: "chromium",
      engine: web({ viewport: { width: 1440, height: 900 } }),
      app: {
        url: appUrl,
        // Saat E2E_APP_URL diisi (mis. production), jangan jalankan dev server.
        ...(process.env.E2E_APP_URL
          ? {}
          : {
              command: {
                executable: "npm",
                args: ["run", "dev", "--", "--port", "3200"],
                env: { NODE_ENV: "development" },
                inheritEnv: ["DATABASE_URL"],
                reuseExisting: true,
                log: ".e2e/logs/app.log",
                startupTimeout: 120_000,
              },
            }),
      },
    },
  ],
  timeout: 120_000,
  workers: 1,
  reporters: ["list", "junit"],
  agents: { default: { model } },
  ...(email && password && password.length >= 6
    ? { credentials: { admin: { username: email, password } } }
    : {}),
};

export default config;
