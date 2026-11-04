import { describe, expect, it } from "vitest";

import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@/lib/import";

describe("batas import aman (maxDuration 60s)", () => {
  it("maks 5.000 baris dan 2MB agar commit tidak timeout", () => {
    expect(IMPORT_MAX_ROWS).toBe(5_000);
    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
