"use client";

import { useCallback, useState } from "react";

type Req = {
  id: number;
  reason: string | null;
  created_at?: string | null;
  tested_as_role: string;
  feature_name: string;
  user_name: string;
  status?: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Gagal (${res.status})`);
  return data;
}

export default function PermohonanView({ initialPending, initialReviewed }: { initialPending: Req[]; initialReviewed: Req[] }) {
  const [pending, setPending] = useState<Req[]>(initialPending);
  const [reviewed, setReviewed] = useState<Req[]>(initialReviewed);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/retest-requests")) as {
      pending: Req[];
      reviewed: Req[];
    };
    setPending(data.pending);
    setReviewed(data.reviewed);
  }, []);


  async function act(id: number, action: "approve" | "reject") {
    setError(null);
    setInfo(null);
    try {
      const body =
        action === "reject"
          ? { rejection_reason: rejectReason[id] ?? "" }
          : undefined;
      await api(`/api/v1/retest-requests/${id}/${action}`, {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
      });
      setInfo(action === "approve" ? "Permohonan disetujui." : "Permohonan ditolak.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Permohonan Pengujian Ulang</h1>
        <p className="page-subtitle">Setujui atau tolak permohonan dari tester. Persetujuan hanya berlaku satu kali.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-700">Menunggu Persetujuan ({pending.length})</h2>
        </div>
        <div className="divide-y divide-neutral-200">
          {pending.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
              <p className="empty-title">Tidak ada permohonan menunggu</p>
              <p className="empty-hint">Semua permohonan sudah ditindaklanjuti.</p>
            </div>
          )}
          {pending.map((r) => (
            <div key={r.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="font-semibold text-neutral-900">{r.feature_name}</div>
                <div className="text-sm text-neutral-600">
                  Diminta oleh {r.user_name} · peran {r.tested_as_role} · {r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : ""}
                </div>
                {r.reason && <div className="text-sm text-neutral-600">Alasan: {r.reason}</div>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button onClick={() => act(r.id, "approve")} className="btn-success-solid">
                  Setujui
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-52">
                  <label htmlFor={`tolak-${r.id}`} className="sr-only">Alasan penolakan untuk {r.feature_name}</label>
                  <input
                    id={`tolak-${r.id}`}
                    value={rejectReason[r.id] ?? ""}
                    onChange={(e) => setRejectReason({ ...rejectReason, [r.id]: e.target.value })}
                    placeholder="Alasan penolakan"
                    className="input mt-0"
                  />
                  <button onClick={() => act(r.id, "reject")} className="btn-danger-soft shrink-0">
                    Tolak
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-700">Riwayat Permohonan</h2>
        </div>
        <div className="divide-y divide-neutral-200">
          {reviewed.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg></span>
              <p className="empty-title">Belum ada riwayat permohonan</p>
              <p className="empty-hint">Permohonan yang sudah disetujui atau ditolak akan tampil di sini.</p>
            </div>
          )}
          {reviewed.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-5 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-semibold text-neutral-900">{r.feature_name}</span>
                <span className="text-neutral-500"> · {r.user_name} · {r.tested_as_role}</span>
                {r.rejection_reason && <div className="mt-1 text-neutral-500">Alasan ditolak: {r.rejection_reason}</div>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`badge ${r.status === "approved" ? "badge-pass" : "badge-fail"}`}>
                  {r.status === "approved" ? "Disetujui" : "Ditolak"}
                </span>
                <span className="text-neutral-500">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString("id-ID") : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
