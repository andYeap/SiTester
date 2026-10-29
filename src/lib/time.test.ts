import { describe, expect, it } from "vitest";

import { addDays, dayMonthLabel, todayString } from "./time";

describe("zona waktu aplikasi", () => {
  it("mengikuti Asia/Jakarta, bukan UTC", () => {
    // 2026-10-28 18:00 UTC = 2026-10-29 01:00 WIB
    expect(todayString(new Date("2026-10-28T18:00:00Z"))).toBe("2026-10-29");
    // 2026-10-28 16:59 UTC = 2026-10-28 23:59 WIB
    expect(todayString(new Date("2026-10-28T16:59:00Z"))).toBe("2026-10-28");
  });

  it("addDays melintasi batas bulan", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-10-29", 3)).toBe("2026-11-01");
  });

  it("label hari/bulan", () => {
    expect(dayMonthLabel("2026-10-29")).toBe("29/10");
  });
});
