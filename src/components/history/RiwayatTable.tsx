"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useState } from "react";

import type { SessionRow } from "@/lib/history";

import DownloadPdfButton from "./DownloadPdfButton";

type Feature = { id: number; name: string };

const badge = (r: string) =>
  r === "pass"
    ? "badge-pass"
    : r === "fail"
      ? "badge-fail"
      : "badge-bug";

function evidenceHref(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `/api/uploads/${path}`;
}

export default function RiwayatTable({
  isKetua,
  initialSessions,
  initialTotal,
  features,
  cycles,
}: {
  isKetua: boolean;
  initialSessions: SessionRow[];
  initialTotal: number;
  features: Feature[];
  cycles: string[];
}) {
  const PAGE_SIZE = 50;
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [result, setResult] = useState("");
  const [q, setQ] = useState("");
  const [cycle, setCycle] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const isLoading = status === "Memuat…";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  async function apply(
    nextPage = 0,
    overrides: Partial<{ dari: string; sampai: string }> = {},
  ) {
    setStatus("Memuat…");
    const v = { dari, sampai, ...overrides };
    const sp = new URLSearchParams();
    if (v.dari) sp.set("dari", v.dari);
    if (v.sampai) sp.set("sampai", v.sampai);
    if (featureId) sp.set("feature_id", featureId);
    if (result) sp.set("result", result);
    if (q) sp.set("q", q);
    if (cycle) sp.set("cycle", cycle);
    if (sort) sp.set("sort", sort);
    sp.set("limit", String(PAGE_SIZE));
    sp.set("offset", String(nextPage * PAGE_SIZE));
    try {
      const res = await fetch(`/api/v1/test-sessions?${sp}`);
      if (!res.ok) {
        setStatus("Gagal memuat riwayat.");
        return;
      }
      const data = (await res.json()) as { sessions: SessionRow[]; total: number };
      setSessions(data.sessions);
      setTotal(data.total);
      setPage(nextPage);
      setStatus(null);
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
    setSort("date_desc");
    setPage(0);
    setSessions(initialSessions);
    setTotal(initialTotal);
    setSavedNotice(null);
  }

  function preset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDari(iso(start));
    setSampai(iso(end));
    void apply(0, { dari: iso(start), sampai: iso(end) });
  }

  const FILTER_KEY = "sitester:riwayat-filters";

  useEffect(() => {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return;
    try {
      const f = JSON.parse(raw) as Record<string, string>;
      setDari(f.dari ?? "");
      setSampai(f.sampai ?? "");
      setFeatureId(f.featureId ?? "");
      setResult(f.result ?? "");
      setQ(f.q ?? "");
      setCycle(f.cycle ?? "");
      setSort(f.sort ?? "date_desc");
      setSavedNotice("Filter tersimpan dipulihkan.");
    } catch {
      localStorage.removeItem(FILTER_KEY);
    }
  }, []);

  function saveFilters() {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({ dari, sampai, featureId, result, q, cycle, sort }),
    );
    setSavedNotice("Filter disimpan di perangkat ini.");
  }

  function clearSaved() {
    localStorage.removeItem(FILTER_KEY);
    setSavedNotice("Filter tersimpan dihapus.");
  }

  function queryString(): string {
    const sp = new URLSearchParams();
    if (dari) sp.set("dari", dari);
    if (sampai) sp.set("sampai", sampai);
    if (featureId) sp.set("feature_id", featureId);
    if (result) sp.set("result", result);
    if (q) sp.set("q", q);
    if (cycle) sp.set("cycle", cycle);
    if (sort) sp.set("sort", sort);
    return sp.toString();
  }

  function exportHref(): string {
    return `/api/v1/export/csv?${queryString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="page-title">Riwayat Pengujian</h1>
          <p className="page-subtitle">Semua hasil yang tercatat — tidak dapat diubah atau dihapus.</p>
        </div>
        <Link href="/pengujian-baru" className="btn-dark">
          + Pengujian Baru
        </Link>
      </div>

      {status && <div className="alert-warn" role="status" aria-live="polite">{status}</div>}

      <div className="card p-5 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="riw-q" className="label text-xs">Cari (catatan / fitur / tester)</label>
            <input id="riw-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void apply(0); }} placeholder="cth: login, bug checkout..." className="input" />
          </div>
          <div>
            <label htmlFor="riw-dari" className="label text-xs">Dari tanggal</label>
            <input id="riw-dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="riw-sampai" className="label text-xs">Sampai tanggal</label>
            <input id="riw-sampai" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="riw-fitur" className="label text-xs">Fitur</label>
            <select id="riw-fitur" value={featureId} onChange={(e) => setFeatureId(e.target.value)} className="input">
              <option value="">Semua</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="riw-hasil" className="label text-xs">Hasil</label>
            <select id="riw-hasil" value={result} onChange={(e) => setResult(e.target.value)} className="input">
              <option value="">Semua</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="bug">Bug</option>
            </select>
          </div>
          <div>
            <label htmlFor="riw-siklus" className="label text-xs">Siklus</label>
            <select id="riw-siklus" value={cycle} onChange={(e) => setCycle(e.target.value)} className="input">
              <option value="">Semua</option>
              {cycles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="riw-urut" className="label text-xs">Urutkan</label>
            <select id="riw-urut" value={sort} onChange={(e) => setSort(e.target.value)} className="input">
              <option value="date_desc">Tanggal terbaru</option>
              <option value="date_asc">Tanggal terlama</option>
              <option value="feature_asc">Fitur A–Z</option>
              <option value="feature_desc">Fitur Z–A</option>
              <option value="result_asc">Hasil A–Z</option>
              <option value="result_desc">Hasil Z–A</option>
              <option value="severity_desc">Severity tertinggi</option>
              <option value="severity_asc">Severity terendah</option>
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <button onClick={() => void apply(0)} className="btn-dark" disabled={isLoading}>Filter</button>
            <button onClick={reset} className="action-link">Atur ulang</button>
            <button onClick={saveFilters} className="action-link">Simpan filter</button>
            <button onClick={clearSaved} className="action-link">Hapus tersimpan</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-500">Preset:</span>
          <button onClick={() => preset(7)} className="btn-soft min-h-9 px-3 py-1">7 hari</button>
          <button onClick={() => preset(30)} className="btn-soft min-h-9 px-3 py-1">30 hari</button>
          {savedNotice && <span className="text-xs text-neutral-500">{savedNotice}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <a href={exportHref()} className="btn-success-solid">Unduh CSV</a>
        <DownloadPdfButton query={queryString()} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden min-w-full text-sm md:table">
            <caption className="sr-only">Riwayat hasil pengujian</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Tanggal</th>
                {isKetua && <th scope="col" className="table-th">Tester</th>}
                <th scope="col" className="table-th">Peran</th>
                <th scope="col" className="table-th">Siklus</th>
                <th scope="col" className="table-th">Fitur</th>
                <th scope="col" className="table-th">Hasil</th>
                <th scope="col" className="table-th">Tingkat Keparahan</th>
                <th scope="col" className="table-th">Ulang</th>
                <th scope="col" className="table-th">Disetujui oleh</th>
                <th scope="col" className="table-th">Bukti</th>
                <th scope="col" className="table-th">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden>
                    <td colSpan={11} className="px-4 py-3">
                      <div className="skeleton h-6" />
                    </td>
                  </tr>
                ))
              ) : (
              sessions.map((s) => (
                <tr key={s.id} className="transition hover:bg-neutral-100">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{new Date(s.tested_at).toLocaleDateString("id-ID")}</td>
                  {isKetua && <td className="px-4 py-3">{s.user_name}</td>}
                  <td className="px-4 py-3 text-neutral-600">{s.tested_as_role}</td>
                  <td className="px-4 py-3 text-neutral-600">{s.test_cycle ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{s.feature_name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${badge(s.result)}`}>{s.result.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.severity ? (
                      <span className="badge badge-outline">{s.severity.toUpperCase()}</span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_retest ? (
                      <span className="badge badge-neutral">Ya</span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{s.approver_name ?? "—"}</td>
                  <td className="space-x-2 px-4 py-3">
                    {(() => {
                      const href = evidenceHref(s.evidence_path);
                      return (
                        <>
                          {href && (
                            <a href={href} target="_blank" rel="noreferrer" className="action-link min-h-9 px-1 text-xs text-neutral-950">Lihat</a>
                          )}
                          {s.evidence_url && (
                            <a href={s.evidence_url} target="_blank" rel="noreferrer" className="action-link min-h-9 px-1 text-xs text-neutral-950">Tautan</a>
                          )}
                          {!href && !s.evidence_url && <span className="text-neutral-400">—</span>}
                        </>
                      );
                    })()}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-neutral-600" title={s.notes ?? ""}>{s.notes ?? "—"}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>

          <div className="divide-y divide-neutral-200 md:hidden">
            {isLoading ? (
              <div className="p-4"><div className="skeleton h-24" /></div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">{s.feature_name}</span>
                    <span className={`badge ${badge(s.result)}`}>{s.result.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {new Date(s.tested_at).toLocaleDateString("id-ID")}
                    {isKetua ? ` · ${s.user_name}` : ""}
                    {` · ${s.tested_as_role}`}
                    {s.test_cycle ? ` · ${s.test_cycle}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.severity && <span className="badge badge-outline">{s.severity.toUpperCase()}</span>}
                    {s.is_retest && <span className="badge badge-neutral">Ulang</span>}
                    {s.evidence_path && (
                      <a
                        href={evidenceHref(s.evidence_path) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neutral-700 underline underline-offset-2"
                      >
                        Bukti
                      </a>
                    )}
                    {s.evidence_url && (
                      <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-neutral-700 underline underline-offset-2">
                        Tautan
                      </a>
                    )}
                  </div>
                  {s.notes && <p className="line-clamp-3 text-sm text-neutral-600">{s.notes}</p>}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 p-4 text-sm print:hidden">
            <p className="text-neutral-500" role="status">
              Menampilkan {from}–{to} dari {total} hasil
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void apply(page - 1)}
                disabled={isLoading || page === 0}
                className="btn-soft px-3 py-1.5 disabled:opacity-50"
                aria-label="Halaman sebelumnya"
              >
                ← Sebelumnya
              </button>
              <span className="text-neutral-500" aria-live="polite">
                Halaman {page + 1} dari {pageCount}
              </span>
              <button
                onClick={() => void apply(page + 1)}
                disabled={isLoading || page + 1 >= pageCount}
                className="btn-soft px-3 py-1.5 disabled:opacity-50"
                aria-label="Halaman berikutnya"
              >
                Berikutnya →
              </button>
            </div>
          </div>
          {!isLoading && sessions.length === 0 && (
            <div className="empty-state border-t border-neutral-200">
              <span className="empty-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></svg></span>
              <p className="empty-title">Belum ada data pengujian</p>
              <p className="empty-hint">Coba ubah filter, atau catat hasil pengujian pertama Anda.</p>
              <Link href="/pengujian-baru" className="btn-primary mt-2">Catat Pengujian</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
