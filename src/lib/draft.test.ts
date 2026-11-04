import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAllDrafts, draftKeyFor } from "@/lib/draft";

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

beforeEach(() => stubStorage());

describe("draft per-pengguna", () => {
  it("key berbeda per user dan stabil", () => {
    const a = draftKeyFor("user-1");
    const b = draftKeyFor("user-2");
    expect(a).not.toBe(b);
    expect(a).toContain("user-1");
    expect(draftKeyFor("user-1")).toBe(a);
  });

  it("anon tidak menimpa user", () => {
    expect(draftKeyFor(undefined)).not.toBe(draftKeyFor("user-1"));
  });

  it("clearAllDrafts menghapus semua key sitester:draft", () => {
    localStorage.setItem("sitester:draft-v3", "x");
    localStorage.setItem(draftKeyFor("u1"), "y");
    clearAllDrafts();
    expect(localStorage.getItem("sitester:draft-v3")).toBeNull();
    expect(localStorage.getItem(draftKeyFor("u1"))).toBeNull();
  });
});
