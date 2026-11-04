import { describe, expect, it } from "vitest";

import { clientIp } from "@/lib/audit";

const req = (headers: Record<string, string>) =>
  new Request("http://test/x", { headers });

describe("clientIp anti-spoof", () => {
  it("pakai entri TERAKHIR x-forwarded-for (ditambah proxy tepercaya)", () => {
    const ip = clientIp(req({ "x-forwarded-for": "9.9.9.9, 10.1.2.3" }));
    expect(ip).toBe("10.1.2.3");
  });

  it("x-real-ip lebih diutamakan bila ada", () => {
    const ip = clientIp(
      req({ "x-real-ip": "10.5.5.5", "x-forwarded-for": "9.9.9.9" }),
    );
    expect(ip).toBe("10.5.5.5");
  });

  it("header tunggal tetap jalan", () => {
    expect(clientIp(req({ "x-forwarded-for": "10.9.9.9" }))).toBe("10.9.9.9");
  });

  it("tanpa header -> null", () => {
    expect(clientIp(req({}))).toBeNull();
  });
});
