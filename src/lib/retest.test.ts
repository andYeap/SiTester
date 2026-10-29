import { describe, expect, it } from "vitest";

import { canTest } from "./retest";

describe("canTest", () => {
  it("membolehkan pengujian pertama (belum pernah diuji)", () => {
    expect(canTest(null, false, false)).toEqual({
      allowed: true,
      requiresApproval: false,
      warning: null,
    });
  });

  it("memblokir pengujian biasa bila terakhir Pass", () => {
    const r = canTest("pass", false, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresApproval).toBe(false);
    expect(r.warning).toMatch(/Pass/);
  });

  it("meminta approval untuk retest atas hasil Pass", () => {
    const r = canTest("pass", true, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresApproval).toBe(true);
  });

  it("membolehkan retest Pass bila ada approval", () => {
    expect(canTest("pass", true, true)).toEqual({
      allowed: true,
      requiresApproval: false,
      warning: null,
    });
  });

  it("membolehkan retest otomatis bila terakhir Fail", () => {
    const r = canTest("fail", true, false);
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(false);
  });

  it("membolehkan retest otomatis bila terakhir Bug", () => {
    const r = canTest("bug", true, false);
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(false);
  });

  it("memberi warning non-blokir untuk pengujian biasa pasca Fail", () => {
    const r = canTest("fail", false, false);
    expect(r.allowed).toBe(true);
    expect(r.warning).toMatch(/FAIL/);
  });
});
