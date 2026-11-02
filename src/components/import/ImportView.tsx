"use client";

import { useState } from "react";

type Row = {
  row: number;
  testedAt: string;
  email: string;
  featureName: string;
  role: string;
  cycle: string | null;
  result: string;
  severity: string | null;
  notes: string | null;
  isRetest: boolean;
  errors: string[];
};

type Preview = {
  summary: { total: number; valid: number; invalid: number };
  rows: Row[];
  truncated?: boolean;
};

export default function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string) {
    if (!file) throw new Error("Pilih file terlebih dahulu.");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(path, { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as Preview & {
      error?: string;
      imported?: number;
    };
    if (!res.ok && res.status !== 422) {
      throw new Error(data.error ?? `Gagal (${res.status}).`);
    }
    return { res, data };
  }

  async function doPreview() {
    setError(null);
    setInfo(null);
    setPreview(null);
    setBusy(true);
    try {
      const { res, data } = await call("/api/v1/import/preview");
      if (res.status === 422) {
        setError(data.error ?? "File tidak valid.");
        return;
      }
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses file.");
    } finally {
      setBusy(false);
    }
  }

  async function doCommit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { res, data } = await call("/api/v1/import/commit");
      if (res.status === 422) {
        setError(data.error ?? "Import dibatalkan.");
        if (data.rows) {
          setPreview({
            summary: data.summary ?? { total: 0, valid: 0, invalid: 0 },
            rows: data.rows,
          });
        }
        return;
      }
      setInfo(`${data.imported ?? 0} baris berhasil diimpor.`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengimpor.");
    } finally {
      setBusy(false);
    }
  }

  const canCommit =
    preview !== null && preview.summary.invalid === 0 && preview.summary.total > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Import Excel/CSV</h1>
        <p className="page-subtitle">
          Pindahkan riwayat pengujian dari spreadsheet. Pratinjau dulu; data baru
          ditulis jika seluruh baris valid.
        </p>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <div className="card-pad space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="import-file" className="label">File .xlsx / .xls / .csv (maks 2MB)</label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setInfo(null); }}
              className="input-file"
            />
          </div>
          <button onClick={() => void doPreview()} disabled={!file || busy} className="btn-soft">
            {busy ? "Memproses..." : "Pratinjau"}
          </button>
          <a href="/api/v1/import/template" className="btn-soft">Unduh template CSV</a>
        </div>

        <details className="text-sm text-neutral-600">
          <summary className="cursor-pointer font-medium text-neutral-800">
            Format kolom
          </summary>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            <li>Tanggal (YYYY-MM-DD atau DD/MM/YYYY), Email Tester, Peran, Siklus (opsional), Fitur, Hasil (Pass/Fail/Bug).</li>
            <li>Severity (wajib untuk Fail/Bug), Lingkungan, Catatan (wajib ≥10 karakter untuk Fail/Bug), Ulang (0/1).</li>
            <li>Fitur/peran/siklus harus sudah ada &amp; aktif. Maksimal 5000 baris.</li>
          </ul>
        </details>
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
            <button onClick={() => void doCommit()} disabled={!canCommit || busy} className="btn-dark">
              {busy ? "Menyimpan..." : `Import ${preview.summary.valid} baris`}
            </button>
            {preview.summary.invalid > 0 && (
              <p className="text-sm text-neutral-600">
                Perbaiki semua baris error lalu unggah ulang.
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
    </div>
  );
}
