"use client";

import { useState } from "react";

import type { SessionRow } from "@/lib/history";

type Feature = { id: number; name: string };

const badge = (r: string) =>
  r === "pass"
    ? "bg-green-100 text-green-700"
    : r === "fail"
      ? "bg-red-100 text-red-700"
      : "bg-orange-100 text-orange-700";

function evidenceHref(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `/api/uploads/${path}`;
}

export default function RiwayatTable({
  isKetua,
  initialSessions,
  features,
  cycles,
}: {
  isKetua: boolean;
  initialSessions: SessionRow[];
  features: Feature[];
  cycles: string[];
}) {
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [status, setStatus] = useState<string | null>(null);

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [result, setResult] = useState("");
  const [q, setQ] = useState("");
  const [cycle, setCycle] = useState("");

  async function apply() {
    setStatus(null);
    const sp = new URLSearchParams();
    if (dari) sp.set("dari", dari);
    if (sampai) sp.set("sampai", sampai);
    if (featureId) sp.set("feature_id", featureId);
    if (result) sp.set("result", result);
    if (q) sp.set("q", q);
    if (cycle) sp.set("cycle", cycle);
    try {
      const res = await fetch(`/api/v1/test-sessions?${sp}`);
      if (!res.ok) {
        setStatus("Gagal memuat riwayat.");
        return;
      }
      const data = (await res.json()) as { sessions: SessionRow[] };
      setSessions(data.sessions);
    } catch {
      setStatus("Gagal memuat riwayat.");
    }
  }

  function reset() {
    setDari("");
    setSampai("");
    setFeatureId("");
    setResult("");
    setQ("");
    setCycle("");
    setSessions(initialSessions);
  }

  function exportHref(): string {
    const sp = new URLSearchParams();
    if (dari) sp.set("dari", dari);
    if (sampai) sp.set("sampai", sampai);
    if (featureId) sp.set("feature_id", featureId);
    if (result) sp.set("result", result);
    if (q) sp.set("q", q);
    if (cycle) sp.set("cycle", cycle);
    return `/api/v1/export/csv?${sp}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Riwayat Pengujian</h1>
        <a href="/pengujian-baru" className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">
          + Pengujian Baru
        </a>
      </div>

      {status && <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">{status}</div>}

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600">Cari (catatan / fitur / tester)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void apply(); }} placeholder="cth: login, bug checkout..." className="mt-1 block w-full rounded-md border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Dari</label>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Sampai</label>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Fitur</label>
            <select value={featureId} onChange={(e) => setFeatureId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm">
              <option value="">Semua</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Hasil</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm">
              <option value="">Semua</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="bug">Bug</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Siklus</label>
            <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-sm">
              <option value="">Semua</option>
              {cycles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button onClick={() => void apply()} className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">Filter</button>
            <button onClick={reset} className="text-sm text-gray-600 hover:underline">Reset</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href={exportHref()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">Export CSV</a>
        <button onClick={() => window.print()} className="rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">Export PDF</button>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                {isKetua && <th className="px-4 py-3 text-left font-medium">Tester</th>}
                <th className="px-4 py-3 text-left font-medium">Peran</th>
                <th className="px-4 py-3 text-left font-medium">Siklus</th>
                <th className="px-4 py-3 text-left font-medium">Fitur</th>
                <th className="px-4 py-3 text-left font-medium">Hasil</th>
                <th className="px-4 py-3 text-left font-medium">Severity</th>
                <th className="px-4 py-3 text-left font-medium">Ulang</th>
                <th className="px-4 py-3 text-left font-medium">Disetujui oleh</th>
                <th className="px-4 py-3 text-left font-medium">Bukti</th>
                <th className="px-4 py-3 text-left font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-4 py-3">{new Date(s.tested_at).toLocaleDateString("id-ID")}</td>
                  {isKetua && <td className="px-4 py-3">{s.user_name}</td>}
                  <td className="px-4 py-3 text-gray-600">{s.tested_as_role}</td>
                  <td className="px-4 py-3 text-gray-600">{s.test_cycle ?? "—"}</td>
                  <td className="px-4 py-3">{s.feature_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge(s.result)}`}>{s.result.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.severity ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{s.severity.toUpperCase()}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_retest ? (
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">Ya</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.approver_name ?? "—"}</td>
                  <td className="space-x-2 px-4 py-3">
                    {(() => {
                      const href = evidenceHref(s.evidence_path);
                      return (
                        <>
                          {href && (
                            <a href={href} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Lihat</a>
                          )}
                          {s.evidence_url && (
                            <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Link</a>
                          )}
                          {!href && !s.evidence_url && <span className="text-gray-400">—</span>}
                        </>
                      );
                    })()}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-gray-600" title={s.notes ?? ""}>{s.notes ?? "—"}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-gray-500">Belum ada data pengujian.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
