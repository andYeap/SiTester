"use client";

import { useCallback, useState } from "react";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Gagal (${res.status})`);
  return data;
}

type Cycle = { id: number; name: string; description: string | null; is_active: boolean; test_count: number };

export default function CycleManager({ initialCycles }: { initialCycles: Cycle[] }) {
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Cycle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/test-cycles")) as { cycles: Cycle[] };
    setCycles(data.cycles);
  }, []);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      if (editing) {
        await api(`/api/v1/test-cycles/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, description: description || null, is_active: editing.is_active }),
        });
        setInfo("Siklus berhasil diperbarui.");
      } else {
        await api("/api/v1/test-cycles", {
          method: "POST",
          body: JSON.stringify({ name, description: description || null, is_active: true }),
        });
        setInfo("Siklus berhasil ditambahkan.");
      }
      setName("");
      setDescription("");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function toggle(c: Cycle) {
    setError(null);
    try {
      await api(`/api/v1/test-cycles/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: c.name, description: c.description, is_active: !c.is_active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function remove(c: Cycle) {
    if (!confirm(`Hapus siklus ${c.name}?`)) return;
    setError(null);
    try {
      await api(`/api/v1/test-cycles/${c.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Siklus Pengujian</h1>
      {error && <div className="alert-err">{error}</div>}
      {info && <div className="alert-ok">{info}</div>}
      <form onSubmit={submit} className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-500">Nama Siklus</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Lensa-ASN R3" className="mt-1 block w-full max-w-md rounded-md border-gray-300 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Deskripsi (opsional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 block w-full max-w-md rounded-md border-gray-300 text-sm" />
        </div>
        <div className="flex gap-2">
          <button className="btn-dark">{editing ? "Simpan" : "+ Tambah"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setName(""); setDescription(""); }} className="text-sm text-gray-600 hover:underline">Batal</button>}
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr><th className="table-th">Nama</th><th className="table-th">Deskripsi</th><th className="table-th">Status</th><th className="table-th">Jumlah Uji</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cycles.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(c)} className={`rounded px-2 py-0.5 text-xs ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3">{c.test_count}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? ""); }} className="text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => remove(c)} className="text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
