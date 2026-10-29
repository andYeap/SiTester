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
      <div>
        <h1 className="page-title">Siklus Pengujian</h1>
        <p className="page-subtitle">Kelompokkan pengujian per ronde (cth: R1, R2). Tes pertama di siklus baru selalu boleh.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}
      <form onSubmit={submit} className="card-pad max-w-xl space-y-4">
        <div>
          <label htmlFor="siklus-nama" className="label">Nama Siklus</label>
          <input id="siklus-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Lensa-ASN R3" className="input" />
        </div>
        <div>
          <label htmlFor="siklus-deskripsi" className="label">Deskripsi <span className="font-normal text-slate-400">(opsional)</span></label>
          <textarea id="siklus-deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-dark">{editing ? "Simpan" : "+ Tambah"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setName(""); setDescription(""); }} className="action-link text-slate-600">Batal</button>}
        </div>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Daftar siklus pengujian</caption>
          <thead className="table-head">
            <tr><th scope="col" className="table-th">Nama</th><th scope="col" className="table-th">Deskripsi</th><th scope="col" className="table-th">Status</th><th scope="col" className="table-th">Jumlah Uji</th><th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cycles.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(c)} aria-pressed={c.is_active} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${c.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.test_count}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    <button onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? ""); }} className="action-link text-indigo-600">Edit</button>
                    <button onClick={() => remove(c)} className="action-link text-red-600">Hapus</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cycles.length === 0 && (
          <div className="empty-state border-t border-slate-100">
            <span className="empty-icon" aria-hidden>🔄</span>
            <p className="empty-title">Belum ada siklus</p>
            <p className="empty-hint">Tambahkan siklus pertama lewat form di atas.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
