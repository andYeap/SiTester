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

export default function DownloadPdfButton({ query }: { query: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const sp = new URLSearchParams(query);
      sp.set("limit", "5000");
      sp.set("offset", "0");
      const res = await fetch(`/api/v1/test-sessions?${sp}`);
      const data = (await res.json()) as {
        sessions?: SessionRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat data laporan.");
      const sessions = data.sessions ?? [];

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("SITester — Laporan Hasil Pengujian", 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Diekspor: ${new Date().toLocaleString("id-ID")} · ${sessions.length} baris (mengikuti filter aktif)`,
        14,
        21,
      );
      autoTable(doc, {
        startY: 26,
        head: [["Tanggal", "Tester", "Peran", "Siklus", "Fitur", "Hasil", "Severity", "Lingkungan", "Ulang", "Catatan"]],
        body: sessionRows(sessions),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [9, 9, 11], textColor: [250, 250, 250] },
      });
      doc.save(buildPdfFileName());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button onClick={() => void download()} disabled={busy} className="btn-soft disabled:opacity-50">
        {busy ? "Menyiapkan PDF..." : "Unduh PDF"}
      </button>
      {error && <span className="text-xs text-neutral-800">{error}</span>}
    </div>
  );
}
