import { defineConfig } from "vitest/config";
import { join } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": join(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/api/**/*.test.ts"],
    setupFiles: ["./tests/api/setup.ts"],
    globalSetup: ["./tests/api/global-setup.ts"],
    testTimeout: 30000,
    pool: "forks",
  },
});
