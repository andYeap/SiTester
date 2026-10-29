"use client";

import { useCallback, useState } from "react";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `Gagal (${res.status})`);
  return data;
}

type Role = { name: string; label: string; is_active: boolean };

export default function RoleManager({ initialRoles }: { initialRoles: Role[] }) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/testing-roles")) as { roles: Role[] };
    setRoles(data.roles);
  }, []);


  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api("/api/v1/testing-roles", {
        method: "POST",
        body: JSON.stringify({ name, label, is_active: true }),
      });
      setName("");
      setLabel("");
      setInfo("Peran berhasil ditambahkan.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function toggle(r: Role) {
    setError(null);
    try {
      await api(`/api/v1/testing-roles/${r.name}`, {
        method: "PUT",
        body: JSON.stringify({ name: r.name, label: r.label, is_active: !r.is_active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function remove(r: Role) {
    if (!confirm(`Hapus peran ${r.label}?`)) return;
    setError(null);
    try {
      await api(`/api/v1/testing-roles/${r.name}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Peran Pengujian</h1>
        <p className="page-subtitle">Peran di aplikasi yang diuji (cth: Admin, Tester). Dipakai di form pengujian.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="peran-nama" className="label text-xs">Nama (kode)</label>
          <input id="peran-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="kepala_bidang" className="input font-mono" />
        </div>
        <div>
          <label htmlFor="peran-label" className="label text-xs">Label tampil</label>
          <input id="peran-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={100} placeholder="Kepala Bidang" className="input" />
        </div>
        <button className="btn-dark">+ Tambah</button>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Daftar peran pengujian</caption>
          <thead className="table-head">
            <tr><th scope="col" className="table-th">Nama</th><th scope="col" className="table-th">Label</th><th scope="col" className="table-th">Status</th><th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {roles.map((r) => (
              <tr key={r.name} className="transition hover:bg-neutral-100">
                <td className="px-4 py-3 font-mono text-xs text-neutral-700">{r.name}</td>
                <td className="px-4 py-3 text-neutral-800">{r.label}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(r)} aria-pressed={r.is_active} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${r.is_active ? "badge-pass" : "badge-neutral"}`}>
                    {r.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r)} className="action-link text-neutral-950">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roles.length === 0 && (
          <div className="empty-state border-t border-neutral-200">
            <span className="empty-icon" aria-hidden>👥</span>
            <p className="empty-title">Belum ada peran</p>
            <p className="empty-hint">Tambahkan peran pertama lewat form di atas.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
