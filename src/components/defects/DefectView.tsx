"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Defect = {
  id: number;
  feature_id: number;
  feature_name: string;
  title: string;
  severity: string | null;
  status: string;
  assignee: string | null;
  fix_reference: string | null;
  note: string | null;
  creator_name: string | null;
  verifier_name: string | null;
  verified_at: string | null;
  created_at: string;
};

const STATUSES = ["open", "reopened", "fixed", "verified", "closed"];

const TRANSITIONS: Record<string, string[]> = {
  open: ["fixed"],
  reopened: ["fixed"],
  fixed: ["verified", "reopened"],
  verified: ["closed", "reopened"],
  closed: ["reopened"],
};

const allowedNext = (s: string) => TRANSITIONS[s] ?? [];

const statusLabel = (s: string) =>
  (({
    open: "Terbuka",
    reopened: "Dibuka kembali",
    fixed: "Diperbaiki",
    verified: "Terverifikasi",
    closed: "Selesai",
  }) as Record<string, string>)[s] ?? s;

const severityLabel = (s: string) =>
  (({ low: "Rendah", medium: "Sedang", high: "Tinggi" }) as Record<string, string>)[s] ?? s;

export default function DefectView({ isKetua }: { isKetua: boolean }) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [status, setStatus] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [features, setFeatures] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (featureId) sp.set("feature_id", featureId);
      const res = await fetch(`/api/v1/defects?${sp}`);
      const data = (await res.json()) as { defects?: Defect[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat defect.");
      setDefects(data.defects ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat defect.");
    } finally {
      setLoading(false);
    }
  }, [status, featureId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/v1/features")
      .then((r) => r.json())
      .then((d: { features?: { id: number; name: string }[] }) =>
        setFeatures(d.features ?? []),
      )
      .catch(() => undefined);
  }, []);

  async function update(d: Defect, next: string) {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/defects/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memperbarui defect.");
      setInfo(`Defect "${d.title}" → ${statusLabel(next)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui defect.");
    }
  }

  async function remove(d: Defect) {
    if (
      !window.confirm(
        `Hapus HANYA defect "${d.title}"?\n\nRiwayat pengujian tidak ikut terhapus.`,
      )
    ) {
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      let res = await fetch(`/api/v1/defects/${d.id}`, { method: "DELETE" });
      let data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        if (
          !window.confirm(
            `${data?.error ?? "Defect ini sebaiknya tidak dihapus langsung."}\n\nTetap hapus defect ini?`,
          )
        ) {
          return;
        }
        res = await fetch(`/api/v1/defects/${d.id}?force=1`, { method: "DELETE" });
        data = (await res.json().catch(() => null)) as { error?: string } | null;
      }
      if (!res.ok) throw new Error(data?.error ?? "Gagal menghapus defect.");
      setInfo(`Defect "${d.title}" dihapus.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus defect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Defect</h1>
        <p className="page-subtitle">
          Temuan Gagal otomatis tercatat. Alur status: Terbuka → Diperbaiki → Terverifikasi → Selesai.
          {isKetua ? " Hanya ketua tim yang dapat memverifikasi." : ""}
        </p>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="defect-status" className="label text-xs">Status</label>
          <select id="defect-status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">Semua</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="defect-feature" className="label text-xs">Fitur</label>
          <select id="defect-feature" value={featureId} onChange={(e) => setFeatureId(e.target.value)} className="input">
            <option value="">Semua</option>
            {features.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <button onClick={() => { setLoading(true); void load(); }} className="btn-soft">Muat ulang</button>
      </div>

      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm table-cards table-sticky-actions">
            <caption className="sr-only">Daftar defect</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Fitur</th>
                <th scope="col" className="table-th">Temuan</th>
                <th scope="col" className="table-th">Urgensi</th>
                <th scope="col" className="table-th">Ubah status</th>
                <th scope="col" className="table-th">Pelapor</th>
                <th scope="col" className="table-th text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-3"><div className="skeleton h-6" /></td></tr>
              ) : defects.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Tidak ada defect pada filter ini.</td></tr>
              ) : (
                defects.map((d) => (
                  <tr key={d.id} className="align-top transition hover:bg-neutral-100">
                    <td data-label="Fitur" className="px-4 py-3">
                      <Link href={`/fitur/${d.feature_id}`} className="font-medium text-neutral-900 underline-offset-2 hover:underline">
                        {d.feature_name}
                      </Link>
                      <div className="text-xs text-neutral-500">{new Date(d.created_at).toLocaleDateString("id-ID")}</div>
                    </td>
                    <td data-label="Temuan" className="px-4 py-3 text-neutral-700">
                      {d.title}
                      {d.fix_reference && <div className="text-xs text-neutral-500">Perbaikan: {d.fix_reference}</div>}
                    </td>
                    <td data-label="Urgensi" className="px-4 py-3">
                      {d.severity ? <span className="badge badge-outline">{severityLabel(d.severity)}</span> : "—"}
                    </td>
                    <td data-label="Ubah status" className="px-4 py-3">
                      <select
                        aria-label={`Ubah status defect ${d.title}`}
                        value={d.status}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next !== d.status) void update(d, next);
                        }}
                        className="input mt-0 w-auto max-w-full text-xs"
                      >
                        {STATUSES.map((s) => {
                          const allowed = s === d.status || allowedNext(d.status).includes(s);
                          return (
                            <option
                              key={s}
                              value={s}
                              disabled={!allowed || (s === "verified" && !isKetua)}
                            >
                              {statusLabel(s)}
                              {!allowed ? " (tidak diizinkan)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {d.verifier_name && (
                        <div className="mt-1 text-xs text-neutral-500">oleh {d.verifier_name}</div>
                      )}
                    </td>
                    <td data-label="Pelapor" className="px-4 py-3 text-neutral-600">{d.creator_name ?? "—"}</td>
                    <td data-label="Aksi" className="action-cell px-4 py-3 text-right">
                      {isKetua ? (
                        <button
                          type="button"
                          onClick={() => void remove(d)}
                          className="action-link min-h-11 px-1 text-xs text-neutral-600"
                        >
                          Hapus
                        </button>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
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
