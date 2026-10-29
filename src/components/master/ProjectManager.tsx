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

type Project = {
  id: number;
  name: string;
  is_active: boolean;
  test_count: number;
  feature_count: number;
};

export default function ProjectManager({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/projects")) as { projects: Project[] };
    setProjects(data.projects);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      if (editing) {
        await api(`/api/v1/projects/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, is_active: editing.is_active }),
        });
        setInfo("Proyek berhasil diperbarui. Fitur terkait ikut berganti nama proyek.");
      } else {
        await api("/api/v1/projects", {
          method: "POST",
          body: JSON.stringify({ name, is_active: true }),
        });
        setInfo("Proyek berhasil ditambahkan.");
      }
      setName("");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  function startEdit(p: Project) {
    setEditing(p);
    setName(p.name);
    setError(null);
    setInfo(null);
  }

  function cancelEdit() {
    setEditing(null);
    setName("");
    setError(null);
  }

  async function toggle(p: Project) {
    setError(null);
    setInfo(null);
    try {
      await api(`/api/v1/projects/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: p.name, is_active: !p.is_active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Hapus proyek "${p.name}"?`)) return;
    setError(null);
    setInfo(null);
    try {
      await api(`/api/v1/projects/${p.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Proyek</h1>
        <p className="page-subtitle">Daftar proyek/aplikasi yang diuji. Dipakai sebagai filter di form pengujian.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="proyek-nama" className="label text-xs">Nama proyek</label>
          <input id="proyek-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="cth: Lensa-ASN" className="input" />
        </div>
        <button className="btn-dark">{editing ? "Simpan" : "+ Tambah"}</button>
        {editing && (
          <button type="button" onClick={cancelEdit} className="action-link">
            Batal
          </button>
        )}
      </form>
      {editing && (
        <p className="text-sm text-neutral-600">
          Mengubah nama akan ikut mengubah kolom Proyek pada semua fitur terkait.
        </p>
      )}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Daftar proyek</caption>
          <thead className="table-head">
            <tr><th scope="col" className="table-th">Nama</th><th scope="col" className="table-th">Status</th><th scope="col" className="table-th">Fitur</th><th scope="col" className="table-th">Uji</th><th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {projects.map((p) => (
              <tr key={p.id} className="transition hover:bg-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">{p.name}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(p)} aria-pressed={p.is_active} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${p.is_active ? "badge-pass" : "badge-neutral"}`}>
                    {p.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-600">{p.feature_count}</td>
                <td className="px-4 py-3 text-neutral-600">{p.test_count}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(p)} className="action-link text-neutral-950">Edit</button>{" "}
                  <button onClick={() => remove(p)} className="action-link text-neutral-950">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="empty-state border-t border-neutral-200">
            <span className="empty-icon" aria-hidden>📁</span>
            <p className="empty-title">Belum ada proyek</p>
            <p className="empty-hint">Tambahkan proyek pertama lewat form di atas.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
