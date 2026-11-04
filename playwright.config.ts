import { defineConfig } from "@playwright/test";

// Sama dengan default di tests/e2e/global-setup.ts. Disamakan agar server dev
// memakai database E2E yang terisolasi, bukan database dev.
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lensa:lensa@127.0.0.1:55432/testlab_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // Serial: satu akun dipakai bareng antar test; login paralel akan
  // saling mencabut sesi (satu sesi aktif per akun).
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "NODE_ENV=development npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
    },
  },
});
