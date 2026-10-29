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
      <h1 className="text-xl font-semibold text-gray-900">Master Fitur</h1>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{info}</div>}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600">Nama Fitur</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} className="mt-1 rounded-md border-gray-300 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Proyek / Sprint</label>
          <input value={project} onChange={(e) => setProject(e.target.value)} maxLength={255} className="mt-1 rounded-md border-gray-300 text-sm" />
        </div>
        <button className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">
          {editing ? "Simpan" : "+ Tambah"}
        </button>
        {editing && (
          <button type="button" onClick={() => { setEditing(null); setName(""); setProject(""); }} className="text-sm text-gray-600 hover:underline">
            Batal
          </button>
        )}
      </form>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium">Proyek</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Verifikasi</th>
                <th className="px-4 py-3 text-left font-medium">Uji</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {features.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">{f.name}</td>
                  <td className="px-4 py-3 text-gray-600">{f.project_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isKetua ? (
                      <button onClick={() => toggle(f)} className={`rounded px-2 py-0.5 text-xs ${f.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {f.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    ) : (
                      <span className={`rounded px-2 py-0.5 text-xs ${f.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {f.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.verified ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Terverifikasi</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800" title={`Diusulkan oleh ${f.creator_name ?? "?"}`}>Usulan baru</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{f.test_count}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {isKetua ? (
                      <>
                        {!f.verified && (
                          <button onClick={() => verify(f)} className="text-green-600 hover:underline">Verifikasi</button>
                        )}
                        <button onClick={() => { setEditing(f); setName(f.name); setProject(f.project_name ?? ""); }} className="text-indigo-600 hover:underline">Edit</button>
                        <button onClick={() => remove(f)} className="text-red-600 hover:underline">Hapus</button>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
