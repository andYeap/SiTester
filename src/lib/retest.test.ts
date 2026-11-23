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

  it("memblokir pengujian biasa bila terakhir Berhasil", () => {
    const r = canTest("pass", false, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresApproval).toBe(false);
    expect(r.warning).toMatch(/Berhasil/);
  });

  it("meminta approval untuk retest atas hasil Berhasil", () => {
    const r = canTest("pass", true, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresApproval).toBe(true);
  });

  it("membolehkan retest Berhasil bila ada approval", () => {
    expect(canTest("pass", true, true)).toEqual({
      allowed: true,
      requiresApproval: false,
      warning: null,
    });
  });

  it("meminta approval untuk retest atas hasil Gagal", () => {
    const r = canTest("fail", true, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresApproval).toBe(true);
  });

  it("membolehkan retest Gagal bila ada approval", () => {
    expect(canTest("fail", true, true)).toEqual({
      allowed: true,
      requiresApproval: false,
      warning: null,
    });
  });

  it("memberi warning non-blokir untuk pengujian biasa pasca Gagal", () => {
    const r = canTest("fail", false, false);
    expect(r.allowed).toBe(true);
    expect(r.warning).toMatch(/Gagal/);
  });
});
