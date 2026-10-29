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

type User = { id: string; name: string; email: string; role: string; test_count: number };

export default function UserManager({ selfId, initialUsers }: { selfId: string; initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tester");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await api("/api/v1/users")) as { users: User[] };
    setUsers(data.users);
  }, []);


  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("tester");
      setInfo("Pengguna berhasil ditambahkan.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function toggleRole(u: User) {
    setError(null);
    try {
      await api(`/api/v1/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: u.role === "ketua_tim" ? "tester" : "ketua_tim" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  async function remove(u: User) {
    if (!confirm(`Hapus pengguna ${u.name}?`)) return;
    setError(null);
    try {
      await api(`/api/v1/users/${u.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Pengguna</h1>
      {error && <div className="alert-err">{error}</div>}
      {info && <div className="alert-ok">{info}</div>}
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500">Nama</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Password (min 8)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="tester">Tester</option>
            <option value="ketua_tim">Ketua Tim</option>
          </select>
        </div>
        <button className="btn-dark">+ Tambah</button>
      </form>
      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr><th className="table-th">Nama</th><th className="table-th">Email</th><th className="table-th">Role</th><th className="table-th">Uji</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.name}{u.id === selfId ? " (Anda)" : ""}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleRole(u)} className={`rounded px-2 py-0.5 text-xs ${u.role === "ketua_tim" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.role === "ketua_tim" ? "Ketua Tim" : "Tester"}
                  </button>
                </td>
                <td className="px-4 py-3">{u.test_count}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(u)} disabled={u.id === selfId} className="text-sm text-red-600 hover:underline disabled:text-gray-300">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
