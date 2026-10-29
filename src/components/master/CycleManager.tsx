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

type Cycle = {
  id: number;
  name: string;
  description: string | null;
  brief: string | null;
  is_active: boolean;
  test_count: number;
  scope_count: number;
  feature_ids: number[];
};

type FeatureOpt = { id: number; name: string; project: string | null };

export default function CycleManager({ initialCycles, initialFeatures }: { initialCycles: Cycle[]; initialFeatures: FeatureOpt[] }) {
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles);
  const [features] = useState<FeatureOpt[]>(initialFeatures);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
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
      const payload = {
        name,
        description: description || null,
        brief: brief || null,
        is_active: editing ? editing.is_active : true,
        feature_ids: scopeIds,
      };
      if (editing) {
        await api(`/api/v1/test-cycles/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setInfo("Siklus berhasil diperbarui.");
      } else {
        await api("/api/v1/test-cycles", { method: "POST", body: JSON.stringify(payload) });
        setInfo("Siklus berhasil ditambahkan.");
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setBrief("");
    setScopeIds([]);
    setScopeSearch("");
    setEditing(null);
  }

  function startEdit(c: Cycle) {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? "");
    setBrief(c.brief ?? "");
    setScopeIds(c.feature_ids ?? []);
    setScopeSearch("");
  }

  function toggleScope(id: number) {
    setScopeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const filteredFeatures = features.filter((f) => {
    const q = scopeSearch.trim().toLowerCase();
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || (f.project ?? "").toLowerCase().includes(q);
  });

  async function toggle(c: Cycle) {
    setError(null);
    try {
      await api(`/api/v1/test-cycles/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: c.name, description: c.description, brief: c.brief ?? null, is_active: !c.is_active, feature_ids: c.feature_ids }),
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
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={submit} className="card-pad space-y-4 xl:sticky xl:top-24">
        <div>
          <label htmlFor="siklus-nama" className="label">Nama Siklus</label>
          <input id="siklus-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Lensa-ASN R3" className="input" />
        </div>
        <div>
          <label htmlFor="siklus-deskripsi" className="label">Deskripsi <span className="font-normal text-neutral-400">(opsional)</span></label>
          <textarea id="siklus-deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" />
        </div>
        <div>
          <label htmlFor="siklus-brief" className="label">Instruksi untuk tester <span className="font-normal text-neutral-400">(opsional)</span></label>
          <textarea id="siklus-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={2000}
            placeholder="Cth: Fokus uji ulang checkout setelah bug #12. Abaikan notifikasi — belum deploy. Kredensial uji: tester@tugas.id / rahasia."
            className="input" />
          <p className="hint">Tampil mencolok saat tester memilih siklus ini.</p>
        </div>
        <div>
          <span id="siklus-scope-label" className="label">Lingkup fitur <span className="font-normal text-neutral-400">(opsional — kosong = semua fitur)</span></span>
          <div className="mt-2 rounded-xl border border-neutral-200 p-3">
            <input
              type="search"
              value={scopeSearch}
              onChange={(e) => setScopeSearch(e.target.value)}
              placeholder="Cari fitur…"
              aria-label="Cari fitur untuk lingkup"
              className="input"
            />
            <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1" role="group" aria-labelledby="siklus-scope-label">
              {filteredFeatures.length === 0 && (
                <p className="py-2 text-center text-sm text-neutral-500">Tidak ada fitur yang cocok.</p>
              )}
              {filteredFeatures.map((f) => (
                <label key={f.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={scopeIds.includes(f.id)}
                    onChange={() => toggleScope(f.id)}
                    className="mt-1 h-4 w-4 accent-neutral-950"
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-neutral-800">{f.name}</span>
                    {f.project && <span className="block text-xs text-neutral-500">{f.project}</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className="hint mt-2">{scopeIds.length === 0 ? "Kosong = semua fitur aktif boleh diuji di siklus ini." : `${scopeIds.length} fitur dipilih.`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-dark">{editing ? "Simpan" : "+ Tambah"}</button>
          {editing && <button type="button" onClick={resetForm} className="action-link">Batal</button>}
        </div>
      </form>
      <div className="card min-w-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Daftar siklus pengujian</caption>
          <thead className="table-head">
            <tr><th scope="col" className="table-th">Nama</th><th scope="col" className="table-th">Deskripsi</th><th scope="col" className="table-th">Lingkup</th><th scope="col" className="table-th">Status</th><th scope="col" className="table-th">Jumlah Uji</th><th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {cycles.map((c) => (
              <tr key={c.id} className="transition hover:bg-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">{c.name}</td>
                <td className="px-4 py-3 text-neutral-600">{c.description ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{c.scope_count > 0 ? `${c.scope_count} fitur` : "Semua fitur"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(c)} aria-pressed={c.is_active} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${c.is_active ? "badge-pass" : "badge-neutral"}`}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-600">{c.test_count}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    <button onClick={() => startEdit(c)} className="action-link text-neutral-950">Edit</button>
                    <button onClick={() => remove(c)} className="action-link text-neutral-950">Hapus</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cycles.length === 0 && (
          <div className="empty-state border-t border-neutral-200">
            <span className="empty-icon" aria-hidden>🔄</span>
            <p className="empty-title">Belum ada siklus</p>
            <p className="empty-hint">Tambahkan siklus pertama lewat form di samping.</p>
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}
