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
      <h1 className="page-title">Permohonan Pengujian Ulang</h1>
      {error && <div className="alert-err">{error}</div>}
      {info && <div className="alert-ok">{info}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-5">
          <h3 className="font-medium text-gray-700">Menunggu Persetujuan ({pending.length})</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {pending.length === 0 && <div className="p-5 text-sm text-gray-500">Tidak ada permohonan yang menunggu.</div>}
          {pending.map((r) => (
            <div key={r.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="font-medium text-gray-900">{r.feature_name}</div>
                <div className="text-sm text-gray-600">
                  Diminta oleh {r.user_name} · peran {r.tested_as_role} · {r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : ""}
                </div>
                {r.reason && <div className="text-sm text-gray-600">Alasan: {r.reason}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => act(r.id, "approve")} className="btn-success-solid">
                  Setujui
                </button>
                <input
                  value={rejectReason[r.id] ?? ""}
                  onChange={(e) => setRejectReason({ ...rejectReason, [r.id]: e.target.value })}
                  placeholder="Alasan penolakan"
                  className="rounded-md border-gray-300 text-sm"
                />
                <button onClick={() => act(r.id, "reject")} className="btn-danger-soft">
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-5">
          <h3 className="font-medium text-gray-700">Riwayat Permohonan</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {reviewed.length === 0 && <div className="p-5 text-sm text-gray-500">Belum ada riwayat permohonan.</div>}
          {reviewed.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-5 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-medium text-gray-900">{r.feature_name}</span>
                <span className="text-gray-500"> · {r.user_name} · {r.tested_as_role}</span>
                {r.rejection_reason && <div className="mt-1 text-gray-500">Alasan ditolak: {r.rejection_reason}</div>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`rounded px-2 py-0.5 font-medium ${r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {r.status === "approved" ? "Disetujui" : "Ditolak"}
                </span>
                <span className="text-gray-500">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString("id-ID") : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
