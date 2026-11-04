import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";

import {
  checkRunnerTarget,
  ipIsPrivateOrReserved,
} from "../../scripts/ai-target-guard.mjs";

const pub = async (): Promise<LookupAddress[]> => [
  { address: "93.184.216.34", family: 4 },
];
const priv = async (): Promise<LookupAddress[]> => [
  { address: "192.168.1.10", family: 4 },
];
const loop = async (): Promise<LookupAddress[]> => [
  { address: "127.0.0.1", family: 4 },
];
const meta = async (): Promise<LookupAddress[]> => [
  { address: "169.254.169.254", family: 4 },
];

describe("penjaga egress runner", () => {
  it("mengenali IP privat dan reserved", () => {
    expect(ipIsPrivateOrReserved("10.0.0.5")).toBe(true);
    expect(ipIsPrivateOrReserved("172.16.9.1")).toBe(true);
    expect(ipIsPrivateOrReserved("172.32.0.1")).toBe(false);
    expect(ipIsPrivateOrReserved("192.168.0.1")).toBe(true);
    expect(ipIsPrivateOrReserved("127.0.0.1")).toBe(true);
    expect(ipIsPrivateOrReserved("169.254.10.20")).toBe(true);
    expect(ipIsPrivateOrReserved("8.8.8.8")).toBe(false);
    expect(ipIsPrivateOrReserved("::1")).toBe(true);
    expect(ipIsPrivateOrReserved("::ffff:10.1.2.3")).toBe(true);
    expect(ipIsPrivateOrReserved("::ffff:8.8.8.8")).toBe(false);
  });

  it("selalu memblokir metadata cloud", async () => {
    const r = await checkRunnerTarget("http://169.254.169.254/", {
      dnsLookup: meta,
      allowPrivate: true,
    });
    expect(r.ok).toBe(false);
  });

  it("memblokir IP privat kecuali diizinkan", async () => {
    const blocked = await checkRunnerTarget("http://intranet.local/", {
      dnsLookup: priv,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain("AI_RUNNER_ALLOW_PRIVATE_TARGETS=1");

    const allowed = await checkRunnerTarget("http://intranet.local/", {
      dnsLookup: priv,
      allowPrivate: true,
    });
    expect(allowed.ok).toBe(true);
  });

  it("melewatkan host publik dan menolak URL/host rusak", async () => {
    expect((await checkRunnerTarget("https://example.test/", { dnsLookup: pub })).ok).toBe(true);
    expect((await checkRunnerTarget("http://localhost:3000/", { dnsLookup: loop })).ok).toBe(false);
    expect((await checkRunnerTarget("javascript:alert(1)", { dnsLookup: pub })).ok).toBe(false);
    expect(
      (
        await checkRunnerTarget("https://tidak-ada.invalid/", {
          dnsLookup: async () => {
            throw new Error("ENOTFOUND");
          },
        })
      ).ok,
    ).toBe(false);
  });
});
