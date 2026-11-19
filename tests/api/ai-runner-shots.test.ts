import { describe, expect, it } from "vitest";

import {
  collectStepScreenshots,
  isSafeShotPath,
  MAX_SHOTS,
} from "../../scripts/ai-runner-shots.mjs";

const report = {
  run: {
    results: [
      {
        attempts: [
          {
            artifacts: [
              { id: "a1", kind: "screenshot", path: "login/attempt-1/001-login.png" },
              { id: "a2", kind: "log", path: "login/attempt-1/app.log" },
              { id: "a3", kind: "screenshot", path: "login/attempt-1/002-assert.png" },
            ],
            steps: [
              { index: 1, api: "agent.act", label: "isi form login", artifacts: ["a1"] },
              { index: 2, api: "agent.assert", label: "dashboard tampil setelah login", artifacts: ["a3", "a2"] },
              { index: 3, api: "agent.assert", label: "duplikat", artifacts: ["a3"] },
            ],
          },
        ],
      },
    ],
  },
};

describe("collectStepScreenshots", () => {
  it("mengambil screenshot berurutan dengan label langkah", () => {
    expect(collectStepScreenshots(report)).toEqual([
      { path: "login/attempt-1/001-login.png", label: "2. agent.act — isi form login" },
      {
        path: "login/attempt-1/002-assert.png",
        label: "3. agent.assert — dashboard tampil setelah login",
      },
    ]);
  });

  it("aman untuk report kosong atau rusak", () => {
    expect(collectStepScreenshots(null)).toEqual([]);
    expect(collectStepScreenshots({ run: { results: [{ attempts: [{}] }] } })).toEqual([]);
  });

  it("memotong hasil pada MAX_SHOTS", () => {
    const many = {
      run: {
        results: [
          {
            attempts: [
              {
                artifacts: Array.from({ length: 12 }, (_, i) => ({
                  id: `s${i}`,
                  kind: "screenshot",
                  path: `x/${i}.png`,
                })),
                steps: Array.from({ length: 12 }, (_, i) => ({
                  index: i,
                  api: "agent.act",
                  label: `langkah ${i}`,
                  artifacts: [`s${i}`],
                })),
              },
            ],
          },
        ],
      },
    };
    expect(collectStepScreenshots(many)).toHaveLength(MAX_SHOTS);
  });

  it("menolak path yang keluar dari direktori hasil", () => {
    expect(isSafeShotPath("run/attempt-1/001.png")).toBe(true);
    expect(isSafeShotPath("../rahasia.png")).toBe(false);
    expect(isSafeShotPath("/etc/passwd")).toBe(false);
    expect(isSafeShotPath("")).toBe(false);
  });
});
