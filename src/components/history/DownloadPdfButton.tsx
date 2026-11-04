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
      // PDF dibuat di server agar browser tidak membeku untuk ribuan baris.
      const res = await fetch(`/api/v1/export/pdf?${sp}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Gagal memuat data laporan.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = buildPdfFileName();
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
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
