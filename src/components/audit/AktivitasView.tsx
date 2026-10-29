"use client";

import { useState } from "react";

import type { SessionUser } from "@/lib/auth";

type LogRow = {
  id: number;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target: string | null;
  changes: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

export default function AktivitasView({
  user,
  initialLogs,
}: {
  user: SessionUser;
  initialLogs: LogRow[];
}) {
  void user;
  const [logs, setLogs] = useState<LogRow[]>(initialLogs);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);

  async function apply() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (action) sp.set("action", action);
      const res = await fetch(`/api/v1/audit-logs?${sp}`);
      if (!res.ok) return;
      const data = (await res.json()) as { logs: LogRow[] };
      setLogs(data.logs);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Log Aktivitas</h1>
        <p className="page-subtitle">Siapa melakukan apa pada data master.</p>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="audit-q" className="block text-xs font-semibold text-neutral-500">Cari (aksi / target / pelaku)</label>
          <input
            id="audit-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void apply(); }}
            placeholder="cth: Fitur Login, ketua"
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="audit-action" className="block text-xs font-semibold text-neutral-500">Aksi</label>
          <select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)} className="input mt-1">
            <option value="">Semua</option>
            {["features.create", "features.update", "features.verify", "features.delete", "testing_roles.create", "testing_roles.update", "testing_roles.delete", "test_cycles.create", "test_cycles.update", "test_cycles.delete", "users.create", "users.update", "users.delete"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button onClick={() => void apply()} disabled={loading} className="btn-dark disabled:opacity-50">
          {loading ? "Memuat..." : "Filter"}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Waktu</th>
                <th scope="col" className="table-th">Pelaku</th>
                <th scope="col" className="table-th">Aksi</th>
                <th scope="col" className="table-th">Target</th>
                <th scope="col" className="table-th">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">
                    {l.actor_name ?? "—"}
                    {l.actor_role && <span className="ml-2 badge badge-neutral">{l.actor_role === "ketua_tim" ? "Ketua" : "Tester"}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{l.action}</td>
                  <td className="px-4 py-3">{l.target ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500" title={l.changes ? JSON.stringify(l.changes) : ""}>
                    {l.changes ? Object.entries(l.changes).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-neutral-500">Belum ada aktivitas tercatat.</p>
                    <p className="mt-1 text-sm text-neutral-400">Aktivitas tambah/ubah/hapus master akan muncul di sini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
