"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { fetchJson } from "@/lib/client-api";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    try {
      await fetchJson("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-32px_rgba(0,0,0,0.35)]">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950">
            Atur Ulang Kata Sandi
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Semua sesi lama akan dikeluarkan setelah password diganti.
          </p>
        </div>

        {!token && (
          <div className="alert-err" role="alert">
            Tautan tidak lengkap. Minta tautan baru dari ketua tim atau halaman lupa password.
          </div>
        )}
        {error && <div className="alert-err" role="alert">{error}</div>}

        {done ? (
          <div className="space-y-4">
            <div className="alert-ok" role="status">
              Password berhasil diubah. Silakan masuk dengan password baru.
            </div>
            <Link href="/login" className="btn-primary w-full py-2.5">
              Ke halaman masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="reset-password" className="label">Password baru</label>
              <input
                id="reset-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm" className="label">Ulangi password</label>
              <input
                id="reset-confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="btn-primary w-full py-2.5"
            >
              {loading ? "Menyimpan..." : "Simpan password baru"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-500">
          <Link href="/login" className="underline underline-offset-2">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
