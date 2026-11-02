"use client";

import { useState } from "react";

type TestCase = {
  id: number;
  title: string;
  steps: string | null;
  expected: string | null;
  is_active: boolean;
  created_by: string | null;
};

export default function TestCaseManager({
  featureId,
  userId,
  isKetua,
  initialCases,
}: {
  featureId: number;
  userId: string;
  isKetua: boolean;
  initialCases: TestCase[];
}) {
  const [cases, setCases] = useState<TestCase[]>(initialCases);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/v1/features/${featureId}/test-cases`);
    const data = (await res.json()) as { testCases?: TestCase[] };
    setCases(data.testCases ?? []);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const body = { title, steps, expected, is_active: true };
      const res = await fetch(
        editing
          ? `/api/v1/test-cases/${editing.id}`
          : `/api/v1/features/${featureId}/test-cases`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan test case.");
      setTitle("");
      setSteps("");
      setExpected("");
      setEditing(null);
      setInfo(editing ? "Test case diperbarui." : "Test case ditambahkan.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan test case.");
    }
  }

  async function remove(c: TestCase) {
    if (!confirm(`Hapus test case "${c.title}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/test-cases/${c.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  function canManage(c: TestCase) {
    return isKetua || c.created_by === userId;
  }

  return (
    <div className="card-pad space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-900">Test Case</h2>
        <p className="hint">Skenario uji untuk fitur ini. Opsional saat mencatat hasil.</p>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="tc-title" className="label text-xs">Judul</label>
          <input id="tc-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} className="input" placeholder="cth: Login dengan password benar" />
        </div>
        <div>
          <label htmlFor="tc-steps" className="label text-xs">Langkah</label>
          <textarea id="tc-steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} className="input" />
        </div>
        <div>
          <label htmlFor="tc-expected" className="label text-xs">Hasil yang diharapkan</label>
          <textarea id="tc-expected" value={expected} onChange={(e) => setExpected(e.target.value)} rows={3} className="input" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn-dark">{editing ? "Simpan" : "+ Tambah test case"}</button>
          {editing && (
            <button
              type="button"
              className="action-link"
              onClick={() => { setEditing(null); setTitle(""); setSteps(""); setExpected(""); }}
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <ul className="divide-y divide-neutral-200">
        {cases.length === 0 ? (
          <li className="py-4 text-sm text-neutral-500">Belum ada test case.</li>
        ) : (
          cases.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {c.title} {!c.is_active && <span className="badge badge-neutral ml-1">Nonaktif</span>}
                </p>
                {c.steps && <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">{c.steps}</p>}
                {c.expected && <p className="mt-1 text-xs text-neutral-500">Diharapkan: {c.expected}</p>}
              </div>
              {canManage(c) && (
                <div className="flex shrink-0 gap-1">
                  <button
                    className="action-link text-xs"
                    onClick={() => { setEditing(c); setTitle(c.title); setSteps(c.steps ?? ""); setExpected(c.expected ?? ""); }}
                  >
                    Edit
                  </button>
                  <button className="action-link text-xs" onClick={() => void remove(c)}>Hapus</button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
