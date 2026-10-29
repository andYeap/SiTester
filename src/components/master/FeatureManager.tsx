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

type Feature = {
  id: number;
  name: string;
  description: string | null;
  project_name: string | null;
  is_active: boolean;
  verified: boolean;
  creator_name: string | null;
  test_count: number;
};

export default function FeatureManager({ isKetua, initialFeatures }: { isKetua: boolean; initialFeatures: Feature[] }) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures);
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [editing, setEditing] = useState<Feature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/features")) as { features: Feature[] };
    setFeatures(data.features);
  }, []);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      if (editing) {
        await api(`/api/v1/features/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            project_name: project || null,
            is_active: editing.is_active,
          }),
        });
        setInfo("Fitur berhasil diperbarui.");
      } else {
        const data = (await api("/api/v1/features", {
          method: "POST",
          body: JSON.stringify({ name, project_name: project || null, is_active: true }),
        })) as { message?: string };
        setInfo(data.message ?? "Fitur berhasil ditambahkan.");
      }
      setName("");
      setProject("");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function toggle(f: Feature) {
    setError(null);
    try {
      await api(`/api/v1/features/${f.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !f.is_active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function verify(f: Feature) {
    setError(null);
    try {
      await api(`/api/v1/features/${f.id}/verify`, { method: "PATCH" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function remove(f: Feature) {
    if (!confirm(`Hapus fitur ${f.name}?`)) return;
    setError(null);
    try {
      await api(`/api/v1/features/${f.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Master Fitur</h1>
        <p className="page-subtitle">Daftar fitur yang bisa diuji. Tester boleh mengusulkan fitur baru.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="fitur-nama" className="label text-xs">Nama Fitur</label>
          <input id="fitur-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} placeholder="cth: Login admin" className="input" />
        </div>
        <div>
          <label htmlFor="fitur-proyek" className="label text-xs">Proyek / Sprint</label>
          <input id="fitur-proyek" value={project} onChange={(e) => setProject(e.target.value)} maxLength={255} placeholder="cth: Lensa-ASN" className="input" />
        </div>
        <button className="btn-dark">
          {editing ? "Simpan" : "+ Tambah"}
        </button>
        {editing && (
          <button type="button" onClick={() => { setEditing(null); setName(""); setProject(""); }} className="action-link">
            Batal
          </button>
        )}
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Daftar fitur</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Nama</th>
                <th scope="col" className="table-th">Proyek</th>
                <th scope="col" className="table-th">Status</th>
                <th scope="col" className="table-th">Verifikasi</th>
                <th scope="col" className="table-th">Uji</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {features.map((f) => (
                <tr key={f.id} className="transition hover:bg-neutral-100">
                  <td className="px-4 py-3 font-medium text-neutral-800">{f.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{f.project_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isKetua ? (
                      <button onClick={() => toggle(f)} aria-pressed={f.is_active} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${f.is_active ? "badge-pass" : "badge-neutral"}`}>
                        {f.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    ) : (
                      <span className={`badge ${f.is_active ? "badge badge-pass" : "badge badge-neutral"}`}>
                        {f.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.verified ? (
                      <span className="badge badge-pass">Terverifikasi</span>
                    ) : (
                      <span className="badge badge-outline" title={`Diusulkan oleh ${f.creator_name ?? "?"}`}>Usulan baru</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{f.test_count}</td>
                  <td className="px-4 py-3 text-right">
                    {isKetua ? (
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {!f.verified && (
                          <button onClick={() => verify(f)} className="action-link text-neutral-950">Verifikasi</button>
                        )}
                        <button onClick={() => { setEditing(f); setName(f.name); setProject(f.project_name ?? ""); }} className="action-link text-neutral-950">Edit</button>
                        <button onClick={() => remove(f)} className="action-link text-neutral-950">Hapus</button>
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {features.length === 0 && (
            <div className="empty-state border-t border-neutral-200">
              <span className="empty-icon" aria-hidden>✨</span>
              <p className="empty-title">Belum ada fitur</p>
              <p className="empty-hint">Tambahkan fitur pertama lewat form di atas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
