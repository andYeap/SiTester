import { describe, expect, it } from "vitest";

import { buildPdfFileName, sessionRows } from "@/components/history/DownloadPdfButton";
import type { SessionRow } from "@/lib/history";

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: 1,
  tested_at: "2026-10-29",
  result: "fail",
  severity: "high",
  environment: "Chrome 126",
  expected: "X",
  actual: "Y",
  notes: "catatan penting",
  is_retest: true,
  tested_as_role: "tester",
  test_cycle: "R1",
  evidence_path: null,
  evidence_url: null,
  user_name: "Tester Satu",
  feature_name: "Login",
  approver_name: "Ketua Tim",
  ...over,
});

describe("unduh PDF", () => {
  it("nama file stabil dan beraekstensi pdf", () => {
    expect(buildPdfFileName(new Date("2026-10-29T10:00:00Z"))).toBe(
      "laporan-pengujian-20261029100000.pdf",
    );
  });

  it("baris memuat kolom sesuai header CSV", () => {
    const rows = sessionRows([row()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Login");
    expect(rows[0]).toContain("FAIL");
    expect(rows[0]).toContain("Ya");
  });
});
