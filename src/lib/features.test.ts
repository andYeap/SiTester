import { describe, expect, it } from "vitest";

import { filterFeatures, groupByProject, matchesQuery, projectNames, type FeatureOption } from "./features";

const f = (over: Partial<FeatureOption> & { name: string }): FeatureOption => ({
  id: Math.floor(Math.random() * 1e9),
  project: null,
  description: null,
  ...over,
});

describe("pencarian fitur", () => {
  const login = f({ name: "Login Pengguna", project: "Proyek Utama", description: "Masuk dengan email dan kata sandi" });
  const qr = f({ name: "Checkout Pembayaran", project: "Proyek Utama", description: "Bayar via QRIS" });
  const lensa = f({ name: "Dashboard Admin", project: "Lensa ASN", description: null });

  it("cocok nama, deskripsi, ATAU proyek", () => {
    expect(matchesQuery(login, "login")).toBe(true);
    expect(matchesQuery(qr, "qris")).toBe(true);
    expect(matchesQuery(qr, "checkout")).toBe(true);
    expect(matchesQuery(lensa, "lensa asn")).toBe(true);
    expect(matchesQuery(login, "keranjang")).toBe(false);
    expect(matchesQuery(login, "")).toBe(true);
    expect(matchesQuery(login, "  LOGIN  ")).toBe(true);
  });

  it("filter gabungan proyek + kata kunci", () => {
    const all = [login, qr, lensa];
    expect(filterFeatures(all, "", "")).toHaveLength(3);
    expect(filterFeatures(all, "", "Proyek Utama").map((x) => x.name)).toEqual([
      "Login Pengguna",
      "Checkout Pembayaran",
    ]);
    expect(filterFeatures(all, "qris", "")).toEqual([qr]);
    expect(filterFeatures(all, "dashboard", "Proyek Utama")).toHaveLength(0);
  });

  it("daftar proyek unik terurut", () => {
    expect(projectNames([login, qr, lensa, f({ name: "X", project: "" })])).toEqual([
      "Lensa ASN",
      "Proyek Utama",
    ]);
  });

  it("grup per proyek, Tanpa proyek paling akhir", () => {
    const groups = groupByProject([lensa, f({ name: "Y", project: null }), login]);
    expect(groups.map((g) => g.project)).toEqual(["Lensa ASN", "Proyek Utama", "Tanpa proyek"]);
    expect(groups[1].items.map((x) => x.name)).toEqual(["Login Pengguna"]);
  });
});
