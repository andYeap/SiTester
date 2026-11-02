"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchJson } from "@/lib/client-api";

export default function LupaPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevUrl(null);
    setLoading(true);
    try {
      const data = await fetchJson<{ message: string; devResetUrl?: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      setMessage(data.message);
      if (data.devResetUrl) setDevUrl(data.devResetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim permintaan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-32px_rgba(0,0,0,0.35)]">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950">
            Lupa Kata Sandi
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Masukkan email akun Anda. Tautan reset berlaku 24 jam.
          </p>
        </div>

        {error && <div className="alert-err" role="alert">{error}</div>}
        {message && <div className="alert-ok" role="status">{message}</div>}
        {devUrl && (
          <div className="alert-warn text-sm">
            <p className="font-semibold">Mode dev (SMTP belum dikonfigurasi):</p>
            <Link href={devUrl} className="break-all underline underline-offset-2">
              {devUrl}
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="lupa-email" className="label">Email</label>
            <input
              id="lupa-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? "Mengirim..." : "Kirim tautan reset"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500">
          <Link href="/login" className="underline underline-offset-2">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
