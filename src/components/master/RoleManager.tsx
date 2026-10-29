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
      <h1 className="page-title">Peran Pengujian</h1>
      {error && <div className="alert-err">{error}</div>}
      {info && <div className="alert-ok">{info}</div>}
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500">Nama (kode)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="kepala_bidang" className="mt-1 rounded-md border-gray-300 font-mono text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Label tampil</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={100} placeholder="Kepala Bidang" className="input" />
        </div>
        <button className="btn-dark">+ Tambah</button>
      </form>
      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr><th className="table-th">Nama</th><th className="table-th">Label</th><th className="table-th">Status</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-3 font-mono text-xs">{r.name}</td>
                <td className="px-4 py-3">{r.label}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(r)} className={`rounded px-2 py-0.5 text-xs ${r.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r)} className="text-sm text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
