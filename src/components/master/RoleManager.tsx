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
      <h1 className="text-xl font-semibold text-gray-900">Peran Pengujian</h1>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{info}</div>}
      <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600">Nama (kode)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="kepala_bidang" className="mt-1 rounded-md border-gray-300 font-mono text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Label tampil</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={100} placeholder="Kepala Bidang" className="mt-1 rounded-md border-gray-300 text-sm" />
        </div>
        <button className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">+ Tambah</button>
      </form>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr><th className="px-4 py-3 text-left font-medium">Nama</th><th className="px-4 py-3 text-left font-medium">Label</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
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
