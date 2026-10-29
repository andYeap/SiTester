"use client";

import { useState } from "react";

type Feature = { id: number; name: string; project_name: string | null };
type Role = { name: string; label: string };
type Cycle = { name: string };
type Check = {
  allowed: boolean;
  requiresApproval: boolean;
  warning: string | null;
  lastResult: string | null;
  hasPendingRequest: boolean;
  hasPendingRequestOwn: boolean;
  duplicateWarning: string | null;
};

const RESULTS = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "bug", label: "Bug" },
];

const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function PengujianForm({
  initialFeatures,
  initialRoles,
  initialCycles,
}: {
  initialFeatures: Feature[];
  initialRoles: Role[];
  initialCycles: Cycle[];
}) {
  const [features] = useState<Feature[]>(initialFeatures);
  const [roles] = useState<Role[]>(initialRoles);
  const [cycles] = useState<Cycle[]>(initialCycles);

  const [testedAt, setTestedAt] = useState(today());
  const [isRetest, setIsRetest] = useState(false);
  const [featureId, setFeatureId] = useState("");
  const [role, setRole] = useState("tester");
  const [cycle, setCycle] = useState("");
  const [result, setResult] = useState("");
  const [severity, setSeverity] = useState("");
  const [environment, setEnvironment] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");

  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function runCheckWith(fId: string, rt: boolean, rl: string, cyc: string) {
    setCheck(null);
    if (!fId) return;
    const q = new URLSearchParams({
      is_retest: rt ? "1" : "0",
      role: rl,
      cycle: cyc,
    });
    const res = await fetch(`/api/v1/features/${fId}/can-test?${q}`);
    if (!res.ok) return;
    setCheck((await res.json()) as Check);
  }

  function checkNow(fId = featureId, rt = isRetest, rl = role, cyc = cycle) {
    runCheckWith(fId, rt, rl, cyc).catch(() => undefined);
  }

  const messages: string[] = [];
  if (check?.warning) messages.push(check.warning);
  if (check?.duplicateWarning) messages.push(check.duplicateWarning);
  if (check?.hasPendingRequestOwn)
    messages.push("Permohonan pengujian ulang Anda untuk fitur ini sedang menunggu persetujuan ketua tim.");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setWarn(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("tested_at", testedAt);
      fd.set("feature_id", featureId);
      fd.set("is_retest", isRetest ? "1" : "0");
      fd.set("tested_as_role", role);
      if (cycle) fd.set("test_cycle", cycle);
      fd.set("result", result);
      if (severity) fd.set("severity", severity);
      if (environment) fd.set("environment", environment);
      if (expected) fd.set("expected", expected);
      if (actual) fd.set("actual", actual);
      if (notes) fd.set("notes", notes);
      if (evidenceUrl) fd.set("evidence_url", evidenceUrl);
      if (evidenceFile) fd.set("evidence", evidenceFile);

      const res = await fetch("/api/v1/test-sessions", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; warning?: string | null };
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setOk("Hasil pengujian berhasil disimpan.");
      if (data.warning) setWarn(data.warning);
      setResult("");
      setSeverity("");
      setNotes("");
      setEvidenceFile(null);
      setEvidenceUrl("");
      checkNow();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  async function requestRetest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/v1/retest-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_id: Number(featureId), tested_as_role: role, reason: reason || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Gagal mengajukan.");
        return;
      }
      setOk("Permohonan pengujian ulang telah dikirim. Menunggu persetujuan ketua tim.");
      checkNow();
    } catch {
      setError("Tidak dapat menghubungi server.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Form Pengujian</h1>
        <p className="page-subtitle">Catat hasil uji manual — validasi retest berjalan otomatis.</p>
      </div>
      {error && <div className="alert-err">{error}</div>}
      {ok && <div className="alert-ok">{ok}</div>}
      {warn && <div className="alert-warn">{warn}</div>}

      <form onSubmit={submit} className="space-y-5 card-pad">
        <div>
          <label className="label">Tanggal Pengujian</label>
          <input type="date" value={testedAt} max={today()} onChange={(e) => setTestedAt(e.target.value)} required className="input" />
        </div>
        <div>
          <label className="label">Apakah ini pengujian ulang?</label>
          <div className="mt-2 flex gap-6">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={!isRetest} onChange={() => { setIsRetest(false); checkNow(featureId, false, role, cycle); }} className="text-indigo-600" /> Tidak
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={isRetest} onChange={() => { setIsRetest(true); checkNow(featureId, true, role, cycle); }} className="text-indigo-600" /> Ya
            </label>
          </div>
        </div>
        <div>
          <label className="label">Diuji sebagai peran</label>
          <select value={role} onChange={(e) => { setRole(e.target.value); checkNow(featureId, isRetest, e.target.value, cycle); }} required className="input">
            {roles.map((r) => (
              <option key={r.name} value={r.name}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Siklus</label>
          <select value={cycle} onChange={(e) => { setCycle(e.target.value); checkNow(featureId, isRetest, role, e.target.value); }} className="input">
            <option value="">— Tanpa siklus —</option>
            {cycles.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fitur yang Diuji</label>
          <select value={featureId} onChange={(e) => { setFeatureId(e.target.value); checkNow(e.target.value, isRetest, role, cycle); }} required className="input">
            <option value="">— Pilih fitur —</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {check && messages.length > 0 && (
          <div className={`rounded-lg p-4 text-sm ${!check.allowed ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-800"}`}>
            {messages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}
        {check && messages.length === 0 && featureId && (
          <div className="alert-ok">Fitur ini siap diuji.</div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Status Hasil</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} required className="input">
              <option value="">— Pilih hasil —</option>
              {RESULTS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Severity (wajib bila Fail/Bug)</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input">
              <option value="">— Pilih severity —</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Lingkungan (opsional)</label>
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="cth: Chrome 126 / Windows 11" className="input" />
          </div>
          <div>
            <label className="label">Yang diharapkan (opsional)</label>
            <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} className="input" />
          </div>
          <div>
            <label className="label">Yang terjadi (opsional)</label>
            <textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2} className="input" />
          </div>
          <div>
            <label className="label">Bukti gambar (opsional, maks 2MB)</label>
            <input type="file" accept="image/*" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
          </div>
          <div>
            <label className="label">atau tautan bukti (opsional)</label>
            <input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://..." className="input" />
          </div>
        </div>

        <div>
          <label className="label">Catatan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Wajib diisi minimal 10 karakter jika hasil Fail/Bug" className="input" />
        </div>

        <button type="submit" disabled={saving || (check !== null && !check.allowed)} className="btn-dark">
          {saving ? "Menyimpan..." : "Simpan Hasil Pengujian"}
        </button>
      </form>

      {check && !check.allowed && check.requiresApproval && (
        <form onSubmit={requestRetest} className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="font-medium text-yellow-900">Ajukan Permohonan Pengujian Ulang</h3>
          <p className="text-sm text-yellow-800">Permohonan akan dikirim ke ketua tim untuk disetujui.</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Alasan (opsional)" className="input border-amber-300" />
          <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600">
            Kirim Permohonan
          </button>
        </form>
      )}
    </div>
  );
}
