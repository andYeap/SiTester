"use client";

import { useState } from "react";

import type { SessionRow } from "@/lib/history";

export function buildPdfFileName(now = new Date()): string {
  const stamp = now
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, "");
  return `laporan-pengujian-${stamp}.pdf`;
}

export function sessionRows(sessions: SessionRow[]): (string | number)[][] {
  return sessions.map((s) => [
    new Date(s.tested_at).toLocaleDateString("id-ID"),
    s.user_name,
    s.tested_as_role,
    s.test_cycle ?? "-",
    s.feature_name,
    s.result.toUpperCase(),
    (s.severity ?? "-").toUpperCase(),
    s.environment ?? "-",
    s.is_retest ? "Ya" : "Tidak",
    s.notes ?? "-",
  ]);
}

export default function DownloadPdfButton({ sessions }: { sessions: SessionRow[] }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("SITester — Laporan Hasil Pengujian", 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Diekspor: ${new Date().toLocaleString("id-ID")} · ${sessions.length} baris`,
        14,
        21,
      );
      autoTable(doc, {
        startY: 26,
        head: [["Tanggal", "Tester", "Peran", "Siklus", "Fitur", "Hasil", "Severity", "Lingkungan", "Ulang", "Catatan"]],
        body: sessionRows(sessions),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [79, 70, 229] },
      });
      doc.save(buildPdfFileName());
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={() => void download()} disabled={busy || sessions.length === 0} className="btn-soft disabled:opacity-50">
      {busy ? "Menyiapkan..." : "Unduh PDF"}
    </button>
  );
}
