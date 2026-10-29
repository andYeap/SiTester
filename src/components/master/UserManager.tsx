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
      <div>
        <h1 className="page-title">Pengguna</h1>
        <p className="page-subtitle">Kelola akun tester dan ketua tim.</p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="user-nama" className="label text-xs">Nama</label>
          <input id="user-nama" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoComplete="name" className="input" />
        </div>
        <div>
          <label htmlFor="user-email" className="label text-xs">Email</label>
          <input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="user-pass" className="label text-xs">Kata sandi (min. 8 karakter)</label>
          <input id="user-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label htmlFor="user-role" className="label text-xs">Peran pengguna</label>
          <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="tester">Tester</option>
            <option value="ketua_tim">Ketua Tim</option>
          </select>
        </div>
        <button className="btn-dark">+ Tambah</button>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Daftar pengguna</caption>
          <thead className="table-head">
            <tr><th scope="col" className="table-th">Nama</th><th scope="col" className="table-th">Email</th><th scope="col" className="table-th">Peran</th><th scope="col" className="table-th">Uji</th><th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-800">{u.name}{u.id === selfId ? " (Anda)" : ""}</td>
                <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleRole(u)} title="Ubah peran" aria-pressed={u.role === "ketua_tim"} className={`badge transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${u.role === "ketua_tim" ? "bg-neutral-100 text-neutral-700" : "bg-neutral-100 text-neutral-600"}`}>
                    {u.role === "ketua_tim" ? "Ketua Tim" : "Tester"}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-600">{u.test_count}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(u)} disabled={u.id === selfId} title={u.id === selfId ? "Anda tidak dapat menghapus akun sendiri" : `Hapus pengguna ${u.name}`} className="action-link disabled:text-neutral-300 disabled:no-underline">Hapus</button>
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
