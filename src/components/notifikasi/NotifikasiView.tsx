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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Notifikasi</h1>
        <button onClick={markAll} className="text-sm text-indigo-600 hover:underline">
          Tandai semua dibaca
        </button>
      </div>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm">
        {items.length === 0 && <div className="p-5 text-sm text-gray-500">Tidak ada notifikasi.</div>}
        {items.map((n) => (
          <div key={n.id} className={`p-4 text-sm ${n.read_at ? "text-gray-500" : "text-gray-900"}`}>
            <div className="font-medium">{n.title}</div>
            {n.body && <div className="mt-1">{n.body}</div>}
            <div className="mt-1 flex gap-3 text-xs text-gray-400">
              <span>{new Date(n.created_at).toLocaleString("id-ID")}</span>
              {n.link && (
                <a href={n.link} className="text-indigo-600 hover:underline">
                  Buka
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
