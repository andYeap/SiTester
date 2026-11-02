"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 20_000;

const FIELDS = [
  { key: "tested_at", label: "Tanggal", required: true },
  { key: "email", label: "Email Tester", required: true },
  { key: "feature", label: "Fitur", required: true },
  { key: "result", label: "Hasil", required: true },
  { key: "role", label: "Peran", required: false },
  { key: "cycle", label: "Siklus", required: false },
  { key: "test_case", label: "Test Case", required: false },
  { key: "severity", label: "Severity", required: false },
  { key: "environment", label: "Lingkungan", required: false },
  { key: "expected", label: "Diharapkan", required: false },
  { key: "actual", label: "Terjadi", required: false },
  { key: "notes", label: "Catatan", required: false },
  { key: "evidence_url", label: "Bukti URL", required: false },
  { key: "is_retest", label: "Ulang", required: false },
] as const;

type Field = (typeof FIELDS)[number]["key"];
type Mapping = Partial<Record<Field, string>>;

type Row = {
  row: number;
  testedAt: string;
  email: string;
  featureName: string;
  role: string;
  cycle: string | null;
  testCaseTitle: string | null;
  result: string;
  severity: string | null;
  notes: string | null;
  isRetest: boolean;
  errors: string[];
};

type Preview = {
  summary: { total: number; valid: number; invalid: number };
  headerErrors: string[];
  headers: string[];
  sheets: string[];
  sheet: string;
  headerRow: number;
  mapping: Record<string, string | null>;
  fileHash: string;
  rows: Row[];
  truncated: boolean;
};

type Batch = {
  id: number;
  file_name: string;
  file_size: number;
  total: number;
  valid: number;
  invalid: number;
  imported: number;
  skipped: number;
  status: string;
  user_name: string | null;
  created_at: string;
};

const MAPPING_KEY = "sitester:import-mapping";

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [savedMapping, setSavedMapping] = useState<Mapping | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/import/batches");
      const data = (await res.json()) as { batches?: Batch[] };
      if (res.ok) setBatches(data.batches ?? []);
    } catch {
      /* riwayat opsional */
    }
  }, []);

  useEffect(() => {
    void loadBatches();
    const raw = localStorage.getItem(MAPPING_KEY);
    if (raw) {
      try {
        setSavedMapping(JSON.parse(raw) as Mapping);
      } catch {
        localStorage.removeItem(MAPPING_KEY);
      }
    }
  }, [loadBatches]);

  function buildForm(): FormData | null {
    if (!file) {
      setError("Pilih file terlebih dahulu.");
      return null;
    }
    if (file.size > MAX_BYTES) {
      setError("Ukuran file maksimal 4MB.");
      return null;
    }
    const fd = new FormData();
    fd.set("file", file);
    if (sheet) fd.set("sheet", sheet);
    fd.set("header_row", String(headerRow));
    const clean: Mapping = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (typeof v === "string" && v !== "") clean[k as Field] = v;
    }
    fd.set("mapping", JSON.stringify(clean));
    return fd;
  }

  function normalizeMapping(input: Record<string, string | null>): Mapping {
    const clean: Mapping = {};
    for (const field of FIELDS) {
      const value = input[field.key];
      if (value) clean[field.key] = value;
    }
    return clean;
  }

  async function doPreview() {
    const fd = buildForm();
    if (!fd) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/import/preview", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as Preview & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Gagal memproses file (${res.status}).`);
        setPreview(null);
        return;
      }
      setPreview(data);
      setSheet(data.sheet);
      setHeaderRow(data.headerRow);
      const detected = normalizeMapping(data.mapping);
      setMapping(detected);
      if (data.headerErrors.length > 0) {
        setError(data.headerErrors.join(" "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses file.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const fd = buildForm();
    if (!fd) return;
    if (preview && preview.summary.invalid > 0 && !skipInvalid) {
      setError('Centang "lewati baris error" atau perbaiki file terlebih dahulu.');
      return;
    }
    fd.set("skip_invalid", skipInvalid ? "1" : "0");
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/import/commit", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        imported?: number;
        skipped?: number;
        invalid?: number;
        rows?: Row[];
        summary?: Preview["summary"];
      };
      if (!res.ok) {
        setError(data.error ?? "Import gagal.");
        if (data.rows && preview) {
          setPreview({
            ...preview,
            summary: data.summary ?? preview.summary,
            rows: data.rows,
          });
        }
        return;
      }
      setInfo(
        `${data.imported ?? 0} baris diimpor${data.skipped ? `, ${data.skipped} duplikat dilewati` : ""}${data.invalid ? `, ${data.invalid} baris invalid dilewati` : ""}.`,
      );
      setPreview(null);
      setFile(null);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadErrors() {
    const fd = buildForm();
    if (!fd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/import/errors", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Gagal membuat laporan error.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "error-import.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat laporan error.");
    } finally {
      setBusy(false);
    }
  }

  function saveMapping() {
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
    setInfo("Mapping kolom disimpan di perangkat ini.");
  }

  function applySavedMapping() {
    if (!savedMapping || !preview) return;
    const applicable: Mapping = {};
    for (const [k, v] of Object.entries(savedMapping)) {
      if (v && preview.headers.includes(v)) applicable[k as Field] = v;
    }
    setMapping(applicable);
    setInfo("Mapping tersimpan diterapkan. Klik Pratinjau ulang untuk memuat hasilnya.");
  }

  const canCommit =
    preview !== null &&
    preview.headerErrors.length === 0 &&
    preview.summary.valid > 0 &&
    (preview.summary.invalid === 0 || skipInvalid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Import Excel/CSV</h1>
        <p className="page-subtitle">
          Pindahkan riwayat pengujian dari spreadsheet. Pratinjau dulu; data
          ditulis hanya untuk baris valid.
        </p>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <div className="card-pad space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="import-file" className="label">
              File .xlsx / .csv (maks 4MB, {MAX_ROWS.toLocaleString("id-ID")} baris)
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setInfo(null);
                setError(null);
              }}
              className="input-file"
            />
            <p className="hint">
              `.xls` lama tidak didukung — simpan ulang sebagai `.xlsx` atau `.csv`.
              Batas 4MB karena batas body request Vercel.
            </p>
          </div>
          <button onClick={() => void doPreview()} disabled={!file || busy} className="btn-soft">
            {busy ? "Memproses..." : "Pratinjau"}
          </button>
          <a href="/api/v1/import/template?format=csv" className="btn-soft">
            Template CSV
          </a>
          <a href="/api/v1/import/template?format=xlsx" className="btn-soft">
            Template XLSX
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="import-sheet" className="label text-xs">Sheet</label>
            <select
              id="import-sheet"
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              disabled={!preview}
              className="input"
            >
              {(preview?.sheets ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="import-header-row" className="label text-xs">Baris header</label>
            <input
              id="import-header-row"
              type="number"
              min={1}
              max={1000}
              value={headerRow}
              onChange={(e) => setHeaderRow(Number(e.target.value) || 1)}
              disabled={!preview}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipInvalid}
                onChange={(e) => setSkipInvalid(e.target.checked)}
                className="h-4 w-4 accent-neutral-950"
              />
              Lewati baris error
            </label>
          </div>
        </div>

        {preview && (
          <div className="space-y-3 rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-neutral-900">Mapping kolom</h2>
              <div className="flex gap-3 text-sm">
                <button type="button" onClick={saveMapping} className="action-link">Simpan mapping</button>
                {savedMapping && (
                  <button type="button" onClick={applySavedMapping} className="action-link">
                    Terapkan tersimpan
                  </button>
                )}
                <button type="button" onClick={() => void doPreview()} disabled={busy} className="action-link">
                  Pratinjau ulang
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`map-${field.key}`} className="label text-xs">
                    {field.label}{field.required ? " *" : ""}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (value) next[field.key] = value;
                        else delete next[field.key];
                        return next;
                      });
                    }}
                    className="input"
                  >
                    <option value="">— tidak dipetakan —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Total", preview.summary.total],
              ["Valid", preview.summary.valid],
              ["Error", preview.summary.invalid],
            ].map(([label, value]) => (
              <div key={String(label)} className="card p-4">
                <div className="text-xs text-neutral-500">{label}</div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => void commit()} disabled={!canCommit || busy} className="btn-dark">
              {busy ? "Menyimpan..." : `Import ${preview.summary.valid} baris valid`}
            </button>
            {preview.summary.invalid > 0 && (
              <button onClick={() => void downloadErrors()} disabled={busy} className="btn-soft">
                Unduh error CSV
              </button>
            )}
            {preview.summary.invalid > 0 && !skipInvalid && (
              <p className="text-sm text-neutral-600">
                Centang “lewati baris error” untuk tetap mengimpor baris valid.
              </p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Pratinjau import</caption>
                <thead className="table-head">
                  <tr>
                    <th scope="col" className="table-th">Baris</th>
                    <th scope="col" className="table-th">Tanggal</th>
                    <th scope="col" className="table-th">Tester</th>
                    <th scope="col" className="table-th">Fitur</th>
                    <th scope="col" className="table-th">Peran</th>
                    <th scope="col" className="table-th">Test Case</th>
                    <th scope="col" className="table-th">Hasil</th>
                    <th scope="col" className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {preview.rows.map((r) => (
                    <tr key={r.row} className={r.errors.length ? "bg-neutral-100" : ""}>
                      <td className="px-4 py-2 tabular-nums">{r.row}</td>
                      <td className="px-4 py-2">{r.testedAt || "—"}</td>
                      <td className="px-4 py-2">{r.email || "—"}</td>
                      <td className="px-4 py-2">{r.featureName || "—"}</td>
                      <td className="px-4 py-2">{r.role}</td>
                      <td className="px-4 py-2">{r.testCaseTitle ?? "—"}</td>
                      <td className="px-4 py-2">{r.result?.toUpperCase()}</td>
                      <td className="px-4 py-2">
                        {r.errors.length === 0 ? (
                          <span className="badge badge-pass">Valid</span>
                        ) : (
                          <ul className="list-disc space-y-0.5 ps-4 text-xs text-neutral-800">
                            {r.errors.map((msg) => <li key={msg}>{msg}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.truncated && (
              <p className="border-t border-neutral-200 p-3 text-xs text-neutral-500">
                Pratinjau dibatasi 500 baris; commit tetap memproses semua baris.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-700">Riwayat Import</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Riwayat import</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Waktu</th>
                <th scope="col" className="table-th">File</th>
                <th scope="col" className="table-th">Oleh</th>
                <th scope="col" className="table-th">Total</th>
                <th scope="col" className="table-th">Masuk</th>
                <th scope="col" className="table-th">Duplikat</th>
                <th scope="col" className="table-th">Error</th>
                <th scope="col" className="table-th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {batches.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">Belum ada riwayat import.</td></tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="transition hover:bg-neutral-100">
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                      {new Date(b.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-neutral-900">{b.file_name}</div>
                      <div className="text-xs text-neutral-500">{fileSize(b.file_size)}</div>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{b.user_name ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{b.total}</td>
                    <td className="px-4 py-2 tabular-nums">{b.imported}</td>
                    <td className="px-4 py-2 tabular-nums">{b.skipped}</td>
                    <td className="px-4 py-2 tabular-nums">{b.invalid}</td>
                    <td className="px-4 py-2">
                      <span className={`badge ${b.status === "committed" ? "badge-pass" : b.status === "failed" ? "badge-fail" : "badge-neutral"}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
