"use client";

import { useCallback, useState } from "react";

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotifikasiView({ initialItems }: { initialItems: Notif[] }) {
  const [items, setItems] = useState<Notif[]>(initialItems);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/notifications");
    if (!res.ok) throw new Error("Gagal memuat notifikasi.");
    const data = (await res.json()) as { notifications: Notif[] };
    setItems(data.notifications);
  }, []);


  async function markAll() {
    setError(null);
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Gagal menandai notifikasi.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Notifikasi</h1>
          <p className="page-subtitle">Keputusan permohonan dan permohonan baru dari tim.</p>
        </div>
        {items.length > 0 && (
          <button onClick={markAll} className="btn-soft text-xs">
            Tandai semua dibaca
          </button>
        )}
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {items.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden>🔔</span>
            <p className="empty-title">Tidak ada notifikasi</p>
            <p className="empty-hint">Keputusan atas permohonan Anda dan permohonan baru akan muncul di sini.</p>
          </div>
        )}
        {items.map((n) => (
          <div key={n.id} className={`flex gap-3 p-4 text-sm transition hover:bg-slate-50 ${n.read_at ? "text-slate-500" : "bg-indigo-50/50 text-slate-900"}`}>
            {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {n.title}
                {!n.read_at && <span className="badge bg-indigo-100 text-indigo-700">Baru</span>}
              </div>
              {n.body && <div className="mt-1 font-normal">{n.body}</div>}
              <div className="mt-1 flex gap-3 text-xs text-slate-400">
                <span>{new Date(n.created_at).toLocaleString("id-ID")}</span>
                {n.link && (
                  <a href={n.link} className="action-link min-h-9 px-1 py-0 text-xs text-indigo-600">
                    Buka
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
