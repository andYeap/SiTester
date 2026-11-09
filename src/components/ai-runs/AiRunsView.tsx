"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";

type Run = {
  id: number;
  target_url: string;
  goal: string;
  success_criteria: string | null;
  status: string;
  result: string | null;
  severity: string | null;
  notes: string | null;
  evidence_path: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  confirmed_session_id: number | null;
  feature_name: string;
  user_name: string;
  has_log: boolean;
};

type RunLog = {
  id: number;
  goal: string;
  status: string;
  notes: string | null;
  error: string | null;
  evidence_path: string | null;
  runner_log: string | null;
};

type Feature = { id: number; name: string };
type Role = { name: string; label: string };
type Cycle = { name: string };

export default function AiRunsView() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [targetUrl, setTargetUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [criteria, setCriteria] = useState("");
  const [featureId, setFeatureId] = useState("");
  const [role, setRole] = useState("tester");
  const [cycle, setCycle] = useState("");
  const [useLogin, setUseLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [loginGoal, setLoginGoal] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginEmailLabel, setLoginEmailLabel] = useState("Email");
  const [loginPasswordLabel, setLoginPasswordLabel] = useState("Kata sandi");
  const [loginSubmitLabel, setLoginSubmitLabel] = useState("Masuk");
  const [logRun, setLogRun] = useState<RunLog | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ai-runs");
      const data = (await res.json()) as { runs?: Run[] };
      if (res.ok) setRuns(data.runs ?? []);
    } catch {
      /* polling opsional */
    }
  }, []);

  useEffect(() => {
    void loadRuns();
    Promise.all([
      fetch("/api/v1/features?active=1").then((r) => r.json()),
      fetch("/api/v1/testing-roles").then((r) => r.json()),
      fetch("/api/v1/test-cycles").then((r) => r.json()),
    ])
      .then(([f, r, c]) => {
        setFeatures((f as { features?: Feature[] }).features ?? []);
        setRoles((r as { roles?: Role[] }).roles ?? []);
        setCycles((c as { cycles?: Cycle[] }).cycles ?? []);
      })
      .catch(() => undefined);
  }, [loadRuns]);

  useEffect(() => {
    const hasActive = runs.some((r) => r.status === "queued" || r.status === "running");
    if (!hasActive) return;
    const timer = setInterval(() => void loadRuns(), 4000);
    return () => clearInterval(timer);
  }, [runs, loadRuns]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/ai-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: targetUrl,
          goal,
          success_criteria: criteria || null,
          feature_id: Number(featureId),
          tested_as_role: role,
          test_cycle: cycle || null,
          use_login: useLogin,
          ...(useLogin
            ? {
                login_url: loginUrl || null,
                login_goal: loginGoal || null,
                login_email: loginEmail || null,
                login_password: loginPassword || null,
                login_email_label: loginEmailLabel || null,
                login_password_label: loginPasswordLabel || null,
                login_submit_label: loginSubmitLabel || null,
              }
            : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat AI test.");
      setInfo(
        "AI test masuk antrean. Runner (VPS/GitHub Actions) akan mengambilnya.",
      );
      setGoal("");
      setCriteria("");
      setLoginEmail("");
      setLoginPassword("");
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat AI test.");
    } finally {
      setBusy(false);
    }
  }

  function evidenceHref(path: string): string {
    return path.startsWith("http") ? path : `/api/uploads/${path}`;
  }

  useEffect(() => {
    if (logRun) logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [logRun]);

  async function openLog(id: number) {
    setLogBusy(true);
    try {
      const res = await fetch(`/api/v1/ai-runs/${id}`);
      const data = (await res.json()) as { run?: RunLog; error?: string };
      if (!res.ok || !data.run) {
        throw new Error(data.error ?? "Gagal memuat log.");
      }
      setLogRun(data.run);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat log.");
    } finally {
      setLogBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">AI Test</h1>
        <p className="page-subtitle">
          Antrekan pengujian otomatis dengan agent AI. Runner di VPS/GitHub Actions
          menjalankan e2e terhadap URL target; hasilnya menjadi draft untuk Anda
          konfirmasi.
        </p>
      </div>

      {error && <div className="alert-err" role="alert">{error}</div>}
      {info && <div className="alert-ok" role="status">{info}</div>}

      <form onSubmit={submit} className="card-pad grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label htmlFor="ai-target" className="label">URL target</label>
          <input
            id="ai-target"
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://staging.aplikasi.test atau http://localhost:3000"
            className="input"
          />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="ai-goal" className="label">Tujuan pengujian (bahasa natural)</label>
          <textarea
            id="ai-goal"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="cth: buka halaman login, masuk sebagai admin, lalu buka menu Pengguna"
            className="input"
          />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="ai-criteria" className="label">Kriteria berhasil</label>
          <textarea
            id="ai-criteria"
            rows={2}
            maxLength={2000}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="cth: tabel pengguna tampil dan berisi minimal satu akun"
            className="input"
          />
          <p className="hint">Dipakai agent untuk menentukan Pass/Fail.</p>
        </div>

        <div className="lg:col-span-2 rounded-lg border border-neutral-200 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={useLogin}
              onChange={(e) => setUseLogin(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-neutral-800">Perlu login ke target</span>
              <span className="mt-1 block text-xs text-neutral-500">
                Agen login dulu sebelum menjalankan tujuan pengujian. Kredensial
                opsional; jika kosong, runner memakai AI_TARGET_EMAIL/PASSWORD.
                Kredensial disimpan terenkripsi dan dihapus setelah run selesai.
              </span>
            </span>
          </label>

          {useLogin && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ai-login-url" className="label">URL login (opsional)</label>
                <input
                  id="ai-login-url"
                  type="url"
                  value={loginUrl}
                  onChange={(e) => setLoginUrl(e.target.value)}
                  placeholder="https://target.test/login"
                  className="input"
                />
                <p className="hint">Kosongkan jika login dilakukan di URL target.</p>
              </div>
              <div>
                <label htmlFor="ai-login-email" className="label">Email target</label>
                <input
                  id="ai-login-email"
                  type="email"
                  autoComplete="off"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="akun-tester@contoh.test"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="ai-login-password" className="label">Password target</label>
                <input
                  id="ai-login-password"
                  type="password"
                  autoComplete="new-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ai-login-goal" className="label">Instruksi login (opsional)</label>
                <input
                  id="ai-login-goal"
                  type="text"
                  maxLength={1000}
                  value={loginGoal}
                  onChange={(e) => setLoginGoal(e.target.value)}
                  placeholder="login dengan email {email} dan password {password} lalu klik Masuk"
                  className="input"
                />
                <p className="hint">Dipakai jika selector di bawah tidak lengkap.</p>
              </div>
              <div>
                <label htmlFor="ai-login-email-label" className="label">Label field email</label>
                <input
                  id="ai-login-email-label"
                  type="text"
                  maxLength={200}
                  value={loginEmailLabel}
                  onChange={(e) => setLoginEmailLabel(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="ai-login-password-label" className="label">Label field password</label>
                <input
                  id="ai-login-password-label"
                  type="text"
                  maxLength={200}
                  value={loginPasswordLabel}
                  onChange={(e) => setLoginPasswordLabel(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="ai-login-submit-label" className="label">Label tombol login</label>
                <input
                  id="ai-login-submit-label"
                  type="text"
                  maxLength={200}
                  value={loginSubmitLabel}
                  onChange={(e) => setLoginSubmitLabel(e.target.value)}
                  className="input"
                />
              </div>
              <p className="hint sm:col-span-2">
                Isi ketiga label untuk login deterministik (lebih cepat dan stabil).
                Kosongkan semuanya jika ingin agent AI mencari field login sendiri.
              </p>
              {(!loginEmailLabel.trim() || !loginPasswordLabel.trim() || !loginSubmitLabel.trim()) && (
                <p className="hint sm:col-span-2" role="note">
                  Label tidak lengkap: password target akan dikirim ke provider model AI saat agent login.
                  Isi ketiga label agar kredensial tidak masuk ke model.
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="ai-feature" className="label">Fitur di SITester</label>
          <select id="ai-feature" required value={featureId} onChange={(e) => setFeatureId(e.target.value)} className="input">
            <option value="">— Pilih fitur —</option>
            {features.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ai-role" className="label">Peran uji</label>
          <select id="ai-role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ai-cycle" className="label">Siklus (opsional)</label>
          <select id="ai-cycle" value={cycle} onChange={(e) => setCycle(e.target.value)} className="input">
            <option value="">— Tanpa siklus —</option>
            {cycles.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button disabled={busy} className="btn-dark">
            {busy ? "Mengantrekan..." : "Antrekan AI Test"}
          </button>
        </div>
      </form>

      {logRun && (
        <div ref={logRef} className="card-pad space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-neutral-700">
                Log runner — run #{logRun.id}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">{logRun.goal}</p>
            </div>
            <button
              type="button"
              onClick={() => setLogRun(null)}
              className="text-sm text-neutral-500 underline underline-offset-2"
            >
              Tutup
            </button>
          </div>
          {logRun.error && (
            <div className="alert-err text-sm" role="alert">
              Error: {logRun.error}
            </div>
          )}
          <figure className="space-y-2">
            <figcaption className="text-xs font-medium text-neutral-500">
              Screenshot hasil run
            </figcaption>
            {logRun.evidence_path ? (
              <a
                href={evidenceHref(logRun.evidence_path)}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- bukti disajikan lewat route ber-login, bukan aset statis */}
                <img
                  src={evidenceHref(logRun.evidence_path)}
                  alt={`Screenshot hasil AI Test run #${logRun.id}`}
                  className="w-full max-w-3xl rounded-lg border border-neutral-200"
                />
              </a>
            ) : (
              <p className="text-xs text-neutral-500">
                Screenshot tidak tersedia untuk run ini. Jalankan ulang AI Test
                untuk menghasilkan bukti baru.
              </p>
            )}
          </figure>
          <pre className="max-h-96 overflow-auto rounded-lg bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
            {logRun.runner_log || "Log tidak tersedia untuk run ini."}
          </pre>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-700">Antrean & Hasil</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Daftar AI test run</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="table-th">Waktu</th>
                <th scope="col" className="table-th">Fitur</th>
                <th scope="col" className="table-th">Target</th>
                <th scope="col" className="table-th">Tujuan</th>
                <th scope="col" className="table-th">Status</th>
                <th scope="col" className="table-th">Hasil</th>
                <th scope="col" className="table-th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {runs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">Belum ada AI test.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-neutral-100">
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                      {new Date(r.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-2 font-medium text-neutral-900">{r.feature_name}</td>
                    <td className="max-w-56 truncate px-4 py-2 text-neutral-600" title={r.target_url}>
                      <a href={r.target_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        {r.target_url}
                      </a>
                    </td>
                    <td className="max-w-72 px-4 py-2 text-neutral-700">
                      <div className="line-clamp-3">{r.goal}</div>
                      {r.success_criteria && <div className="mt-1 line-clamp-2 text-xs text-neutral-500">Kriteria: {r.success_criteria}</div>}
                      {r.error && <div className="mt-1 text-xs text-neutral-800">Error: {r.error}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`badge ${r.status === "completed" ? "badge-pass" : r.status === "failed" || r.status === "error" ? "badge-fail" : "badge-neutral"}`}>
                        {r.status === "error" ? "error (provider)" : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.result ? (
                        <span className={`badge ${r.result === "pass" ? "badge-pass" : r.result === "fail" ? "badge-fail" : "badge-bug"}`}>
                          {r.result.toUpperCase()}
                        </span>
                      ) : "—"}
                      {r.evidence_path && (
                        <a href={evidenceHref(r.evidence_path)} target="_blank" rel="noreferrer" className="ml-2 text-xs underline underline-offset-2">
                          Bukti
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.has_log ? (
                          <button
                            type="button"
                            disabled={logBusy}
                            onClick={() => void openLog(r.id)}
                            className="action-link text-neutral-950"
                          >
                            Log
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Log tidak tersedia untuk run lama"
                            className="action-link cursor-not-allowed text-neutral-400"
                          >
                            Log
                          </button>
                        )}
                        {r.status === "completed" && !r.confirmed_session_id ? (
                          <a href={`/pengujian-baru?ai_run=${r.id}`} className="action-link text-neutral-950">
                            Konfirmasi
                          </a>
                        ) : r.confirmed_session_id ? (
                          <span className="text-xs text-neutral-500">Tersimpan</span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert-info text-sm">
        Runner tidak berjalan di Vercel. Untuk online 24 jam gratis, jalankan{" "}
        <code className="font-mono">npm run ai-runner</code> di VPS gratis (mis. Oracle
        Cloud Always Free) atau biarkan GitHub Actions terjadwal mengambil antrean.
      </div>
    </div>
  );
}
