"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import type { SessionRow } from "@/lib/history";

import DownloadPdfButton from "./DownloadPdfButton";

type Feature = { id: number; name: string };

const badge = (r: string) => (r === "pass" ? "badge-pass" : "badge-fail");

const resultLabel = (r: string) => (r === "pass" ? "Berhasil" : "Gagal");

const severityLabel = (s: string) =>
  (({ low: "Rendah", medium: "Sedang", high: "Tinggi" }) as Record<string, string>)[s] ?? s;

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
  projects,
}: {
  isKetua: boolean;
  initialSessions: SessionRow[];
  initialTotal: number;
  features: Feature[];
  cycles: string[];
  projects: string[];
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
  const [project, setProject] = useState("");
  const [ai, setAi] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<SessionRow | null>(null);
  const [editForm, setEditForm] = useState({
    result: "pass",
    severity: "",
    expected: "",
    actual: "",
    notes: "",
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    if (project) sp.set("project", project);
    if (ai) sp.set("ai", ai);
    if (ai === "ai" && aiCategory) sp.set("ai_category", aiCategory);
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
    setProject("");
    setAi("");
    setAiCategory("");
    setSort("date_desc");
    setPage(0);
    setSessions(initialSessions);
    setTotal(initialTotal);
    setSavedNotice(null);
  }

  function preset(days: number) {    const end = new Date();
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
      setProject(f.project ?? "");
      setAi(f.ai ?? "");
      setAiCategory(f.aiCategory ?? "");
      setSort(f.sort ?? "date_desc");
      setSavedNotice("Filter tersimpan dipulihkan.");
    } catch {
      localStorage.removeItem(FILTER_KEY);
    }
  }, []);

  function saveFilters() {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({ dari, sampai, featureId, result, q, cycle, project, ai, aiCategory, sort }),
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
    if (project) sp.set("project", project);
    if (ai) sp.set("ai", ai);
    if (ai === "ai" && aiCategory) sp.set("ai_category", aiCategory);
    if (sort) sp.set("sort", sort);
    return sp.toString();
  }

  function exportHref(): string {
    return `/api/v1/export/csv?${queryString()}`;
  }

  function openEdit(s: SessionRow) {
    setActionError(null);
    setEditRow(s);
    setEditForm({
      result: s.result,
      severity: s.severity ?? "",
      expected: s.expected ?? "",
      actual: s.actual ?? "",
      notes: s.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editRow) return;
    setBusyId(editRow.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/test-sessions/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan koreksi.");
      setEditRow(null);
      await apply(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan koreksi.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSession(s: SessionRow) {
    const tanggal = new Date(s.tested_at).toLocaleDateString("id-ID");
    if (
      !window.confirm(
        `Hapus HANYA riwayat "${s.feature_name}" (${tanggal})?\n\n` +
          "Riwayat lain, defect, dan AI run tidak ikut terhapus.",
      )
    ) {
      return;
    }
    setBusyId(s.id);
    setActionError(null);
    try {
      let res = await fetch(`/api/v1/test-sessions/${s.id}`, {
        method: "DELETE",
      });
      let data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        if (
          !window.confirm(
            `${data?.error ?? "Riwayat ini tertaut data lain."}\n\nTetap hapus satu riwayat ini?`,
          )
        ) {
          return;
        }
        res = await fetch(`/api/v1/test-sessions/${s.id}?force=1`, {
          method: "DELETE",
        });
        data = (await res.json().catch(() => null)) as { error?: string } | null;
      }
      if (!res.ok) throw new Error(data?.error ?? "Gagal menghapus riwayat.");
      setSavedNotice("Riwayat dihapus.");
      await apply(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus riwayat.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="page-title">Riwayat Pengujian</h1>
          <p className="page-subtitle">Semua hasil yang tercatat. Ketua tim dapat mengoreksi atau menghapus; setiap perubahan masuk log aktivitas.</p>
        </div>
        <Link href="/pengujian-baru" className="btn-dark">
          + Pengujian Baru
        </Link>
      </div>

      {status && <div className="alert-warn" role="status" aria-live="polite">{status}</div>}
      {actionError && <div className="alert-err" role="alert">{actionError}</div>}

      <div className="card p-5 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="riw-q" className="label text-xs">Cari (catatan / fitur / tester)</label>
            <input id="riw-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void apply(0); }} placeholder="cth: login, gagal checkout..." className="input" />
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
            <label htmlFor="riw-proyek" className="label text-xs">Proyek</label>
            <select id="riw-proyek" value={project} onChange={(e) => setProject(e.target.value)} className="input">
              <option value="">Semua</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="riw-hasil" className="label text-xs">Hasil</label>
            <select id="riw-hasil" value={result} onChange={(e) => setResult(e.target.value)} className="input">
              <option value="">Semua</option>
              <option value="pass">Berhasil</option>
              <option value="fail">Gagal</option>
            </select>
          </div>
          <div>
            <label htmlFor="riw-sumber" className="label text-xs">Sumber</label>
            <select id="riw-sumber" value={ai} onChange={(e) => setAi(e.target.value)} className="input">
              <option value="">Semua</option>
              <option value="manual">Manual</option>
              <option value="ai">AI Test</option>
            </select>
          </div>
          {ai === "ai" && (
            <div>
              <label htmlFor="riw-kategori-ai" className="label text-xs">Kategori AI</label>
              <select id="riw-kategori-ai" value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} className="input">
                <option value="">Semua kategori</option>
                <option value="fungsional">Fungsional</option>
                <option value="ketahanan">Ketahanan</option>
                <option value="stress">Stress testing</option>
                <option value="keamanan">Keamanan dasar</option>
              </select>
            </div>
          )}
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
              <option value="severity_desc">Urgensi tertinggi</option>
              <option value="severity_asc">Urgensi terendah</option>
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
        {editRow && (
          <div className="space-y-3 border-b border-neutral-200 bg-neutral-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-neutral-800">
                Koreksi riwayat #{editRow.id} — {editRow.feature_name}
              </h2>
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="action-link text-xs"
              >
                Tutup
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="koreksi-hasil" className="label text-xs">Hasil</label>
                <select
                  id="koreksi-hasil"
                  className="input"
                  value={editForm.result}
                  onChange={(e) => setEditForm({ ...editForm, result: e.target.value })}
                >
                  <option value="pass">Berhasil</option>
                  <option value="fail">Gagal</option>
                </select>
              </div>
              <div>
                <label htmlFor="koreksi-severity" className="label text-xs">Tingkat urgensi</label>
                <select
                  id="koreksi-severity"
                  className="input"
                  value={editForm.severity}
                  disabled={editForm.result === "pass"}
                  onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                  <option value="high">Tinggi</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="koreksi-catatan" className="label text-xs">Catatan</label>
                <textarea
                  id="koreksi-catatan"
                  className="input"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="koreksi-harapan" className="label text-xs">Hasil diharapkan</label>
                <textarea
                  id="koreksi-harapan"
                  className="input"
                  rows={2}
                  value={editForm.expected}
                  onChange={(e) => setEditForm({ ...editForm, expected: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="koreksi-kenyataan" className="label text-xs">Hasil sebenarnya</label>
                <textarea
                  id="koreksi-kenyataan"
                  className="input"
                  rows={2}
                  value={editForm.actual}
                  onChange={(e) => setEditForm({ ...editForm, actual: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busyId !== null}
                className="btn-dark"
              >
                {busyId === editRow.id ? "Menyimpan…" : "Simpan koreksi"}
              </button>
              <button type="button" onClick={() => setEditRow(null)} className="btn-soft">
                Batal
              </button>
            </div>
          </div>
        )}
        <div className="table-scroll">
          <table className="hidden min-w-full text-sm md:table table-sticky-actions">
            <caption className="sr-only">Riwayat hasil pengujian</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Tanggal</th>
                {isKetua && <th scope="col" className="table-th">Tester</th>}
                <th scope="col" className="table-th">Fitur</th>
                <th scope="col" className="table-th">Hasil</th>
                <th scope="col" className="table-th">Urgensi</th>
                <th scope="col" className="table-th text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden>
                    <td colSpan={isKetua ? 6 : 5} className="px-4 py-3">
                      <div className="skeleton h-6" />
                    </td>
                  </tr>
                ))
              ) : (
              sessions.map((s) => (
                <Fragment key={s.id}>
                  <tr className="transition hover:bg-neutral-100">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{new Date(s.tested_at).toLocaleDateString("id-ID")}</td>
                    {isKetua && <td className="px-4 py-3">{s.user_name}</td>}
                    <td className="px-4 py-3 font-medium text-neutral-900">{s.feature_name}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${badge(s.result)}`}>{resultLabel(s.result)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.severity ? (
                        <span className="badge badge-outline">{severityLabel(s.severity)}</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="action-cell px-4 py-3 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailId(detailId === s.id ? null : s.id)}
                          className="action-link min-h-9 px-1 text-xs text-neutral-950"
                          aria-expanded={detailId === s.id}
                        >
                          {detailId === s.id ? "Tutup" : "Detail"}
                        </button>
                        {isKetua && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="action-link min-h-9 px-1 text-xs text-neutral-950"
                            >
                              Koreksi
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeSession(s)}
                              disabled={busyId === s.id}
                              className="action-link min-h-9 px-1 text-xs text-neutral-600 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                  {detailId === s.id && (
                    <tr className="bg-neutral-50">
                      <td colSpan={isKetua ? 6 : 5} className="px-4 py-4">
                        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Peran</p>
                            <p className="mt-0.5 text-neutral-800">{s.tested_as_role}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Siklus</p>
                            <p className="mt-0.5 text-neutral-800">{s.test_cycle ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Uji ulang</p>
                            <p className="mt-0.5 text-neutral-800">{s.is_retest ? "Ya" : "Tidak"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Disetujui oleh</p>
                            <p className="mt-0.5 text-neutral-800">{s.approver_name ?? "—"}</p>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Catatan</p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-neutral-800">{s.notes ?? "—"}</p>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Bukti</p>
                            <div className="mt-0.5 flex flex-wrap gap-3">
                              {(() => {
                                const href = evidenceHref(s.evidence_path);
                                return (
                                  <>
                                    {href && (
                                      <a href={href} target="_blank" rel="noreferrer" className="action-link min-h-9 px-1 text-xs text-neutral-950">Lihat bukti</a>
                                    )}
                                    {s.evidence_url && (
                                      <a href={s.evidence_url} target="_blank" rel="noreferrer" className="action-link min-h-9 px-1 text-xs text-neutral-950">Buka tautan</a>
                                    )}
                                    {!href && !s.evidence_url && <span className="text-neutral-400">—</span>}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
                    <span className={`badge ${badge(s.result)}`}>{resultLabel(s.result)}</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {new Date(s.tested_at).toLocaleDateString("id-ID")}
                    {isKetua ? ` · ${s.user_name}` : ""}
                    {` · ${s.tested_as_role}`}
                    {s.test_cycle ? ` · ${s.test_cycle}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.severity && <span className="badge badge-outline">{severityLabel(s.severity)}</span>}
                    {s.is_retest && <span className="badge badge-neutral">Ulang</span>}
                    {s.approver_name && <span className="text-neutral-500">Disetujui: {s.approver_name}</span>}
                    {s.evidence_path && (
                      <a
                        href={evidenceHref(s.evidence_path) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-neutral-700 underline underline-offset-2"
                      >
                        Bukti
                      </a>
                    )}
                    {s.evidence_url && (
                      <a href={s.evidence_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-neutral-700 underline underline-offset-2">
                        Tautan
                      </a>
                    )}
                  </div>
                  {s.notes && <p className="line-clamp-3 text-sm text-neutral-600">{s.notes}</p>}
                  {isKetua && (
                    <div className="flex gap-3 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="inline-flex min-h-11 items-center text-neutral-950 underline underline-offset-2"
                      >
                        Koreksi
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSession(s)}
                        disabled={busyId === s.id}
                        className="inline-flex min-h-11 items-center text-neutral-600 underline underline-offset-2 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
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
