"use client";

import { useMemo, useState } from "react";

import { projectNames } from "@/lib/features";
import { todayString } from "@/lib/time";
import FeatureCombobox from "./FeatureCombobox";

type Feature = { id: number; name: string; project_name: string | null; description: string | null };
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

const today = () => todayString();

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
  const [projectFilter, setProjectFilter] = useState("");
  const [cycleBrief, setCycleBrief] = useState<string | null>(null);
  const [scopeIds, setScopeIds] = useState<number[] | null>(null);
  const projects = useMemo(() => projectNames(features.map((f) => ({ project: f.project_name }))), [features]);
  const scopedFeatures = useMemo(
    () => (scopeIds === null ? features : features.filter((f) => scopeIds.includes(f.id))),
    [features, scopeIds],
  );

  async function loadCycleInfo(name: string) {
    setCycleBrief(null);
    setScopeIds(null);
    if (!name) return;
    try {
      const res = await fetch("/api/v1/test-cycles");
      if (!res.ok) return;
      const data = (await res.json()) as {
        cycles: { name: string; brief: string | null; feature_ids: number[] }[];
      };
      const found = (data.cycles ?? []).find((c) => c.name === name);
      if (!found) return;
      setCycleBrief(found.brief);
      setScopeIds(found.feature_ids.length > 0 ? found.feature_ids.map(Number) : null);
    } catch {
      /* abaikan: form tetap bisa dipakai tanpa lingkup */
    }
  }

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
    if (featureId === "") {
      setError("Pilih dulu fitur yang diuji.");
      return;
    }
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
      {error && <div className="alert-err" role="alert">{error}</div>}
      {ok && <div className="alert-ok" role="status">{ok}</div>}
      {warn && <div className="alert-warn">{warn}</div>}

      <form onSubmit={submit} className="space-y-5 card-pad">
        <div>
          <label className="label" htmlFor="uji-tanggal">Tanggal Pengujian</label>
          <input id="uji-tanggal" type="date" value={testedAt} max={today()} onChange={(e) => setTestedAt(e.target.value)} required className="input" />
        </div>
        <fieldset>
          <legend className="label">Apakah ini pengujian ulang?</legend>
          <div className="mt-2 flex gap-6">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="uji-retest" checked={!isRetest} onChange={() => { setIsRetest(false); checkNow(featureId, false, role, cycle); }} className="h-4 w-4 accent-neutral-950" /> Tidak
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="uji-retest" checked={isRetest} onChange={() => { setIsRetest(true); checkNow(featureId, true, role, cycle); }} className="h-4 w-4 accent-neutral-950" /> Ya
            </label>
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="uji-peran">Diuji sebagai peran</label>
          <select id="uji-peran" value={role} onChange={(e) => { setRole(e.target.value); checkNow(featureId, isRetest, e.target.value, cycle); }} required className="input">
            {roles.map((r) => (
              <option key={r.name} value={r.name}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="uji-siklus">Siklus</label>
          <select id="uji-siklus" value={cycle} onChange={(e) => {
            const v = e.target.value;
            setCycle(v);
            setFeatureId("");
            setCheck(null);
            void loadCycleInfo(v);
          }} className="input">
            <option value="">— Tanpa siklus —</option>
            {cycles.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {cycleBrief && (
            <div className="alert-info mt-2" role="note">
              <p className="font-semibold">Instruksi {cycle}</p>
              <p className="whitespace-pre-wrap">{cycleBrief}</p>
            </div>
          )}
          {scopeIds !== null && (
            <p className="hint mt-1">Siklus ini mencakup {scopeIds.length} fitur — daftar di bawah sudah disaring.</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="uji-proyek">Filter proyek</label>
          <select id="uji-proyek" value={projectFilter} onChange={(e) => {
            const p = e.target.value;
            setProjectFilter(p);
            const cur = features.find((f) => String(f.id) === featureId);
            if (p !== "" && (!cur || (cur.project_name ?? "") !== p)) {
              setFeatureId("");
              checkNow("", isRetest, role, cycle);
            }
          }} className="input">
            <option value="">Semua proyek</option>
            {projects.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <p className="hint">Batasi daftar bila fitur sudah banyak.</p>
        </div>
        <FeatureCombobox
          id="uji-fitur"
          label="Fitur yang Diuji"
          features={scopedFeatures.map((f) => ({ id: f.id, name: f.name, project: f.project_name, description: f.description }))}
          value={featureId}
          project={projectFilter}
          onChange={(id) => { setFeatureId(id); checkNow(id, isRetest, role, cycle); }}
        />

        <div aria-live="polite">
        {check && messages.length > 0 && (
          <div className={!check.allowed ? "alert-err" : "alert-warn"}>
            {messages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}
        {check && messages.length === 0 && featureId && (
          <div className="alert-ok">Fitur ini siap diuji.</div>
        )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="uji-hasil">Status Hasil</label>
            <select id="uji-hasil" value={result} onChange={(e) => setResult(e.target.value)} required className="input">
              <option value="">— Pilih hasil —</option>
              {RESULTS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="uji-severity">Tingkat Keparahan</label>
            <select id="uji-severity" aria-describedby="uji-severity-hint" value={severity} onChange={(e) => setSeverity(e.target.value)} className="input">
              <option value="">— Pilih tingkat keparahan —</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="hint" id="uji-severity-hint">Wajib diisi bila hasil Fail atau Bug.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="uji-env">Lingkungan <span className="font-normal text-neutral-400">(opsional)</span></label>
            <input id="uji-env" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="cth: Chrome 126 / Windows 11" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="uji-expected">Yang diharapkan <span className="font-normal text-neutral-400">(opsional)</span></label>
            <textarea id="uji-expected" value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="uji-actual">Yang terjadi <span className="font-normal text-neutral-400">(opsional)</span></label>
            <textarea id="uji-actual" value={actual} onChange={(e) => setActual(e.target.value)} rows={2} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="uji-file">Bukti gambar <span className="font-normal text-neutral-400">(opsional, maks 2MB)</span></label>
            <input id="uji-file" type="file" accept="image/*" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} className="input-file" />
          </div>
          <div>
            <label className="label" htmlFor="uji-url">atau tautan bukti <span className="font-normal text-neutral-400">(opsional)</span></label>
            <input id="uji-url" type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://..." className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="uji-notes">Catatan</label>
          <p className="hint" id="uji-notes-hint">Wajib minimal 10 karakter bila hasil Fail atau Bug.</p>
          <textarea id="uji-notes" aria-describedby="uji-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Jelaskan langkah dan hasil yang ditemui…" className="input" />
        </div>

        <button type="submit" disabled={saving || (check !== null && !check.allowed)} className="btn-dark">
          {saving ? "Menyimpan..." : "Simpan Hasil Pengujian"}
        </button>
      </form>

      {check && !check.allowed && check.requiresApproval && (
        <form onSubmit={requestRetest} className="card-pad space-y-4 border-2 border-neutral-950">
          <h3 className="font-semibold text-neutral-950">Ajukan Permohonan Pengujian Ulang</h3>
          <p className="text-sm text-neutral-700">Hasil terakhir untuk kombinasi ini sudah Pass. Permohonan akan dikirim ke ketua tim untuk disetujui sebelum Anda bisa menguji ulang.</p>
          <div>
            <label className="label" htmlFor="uji-reason">Alasan <span className="font-normal text-neutral-400">(opsional)</span></label>
            <textarea id="uji-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="cth: verifikasi perbaikan dari developer…" className="input" />
          </div>
          <button className="btn-dark">
            Kirim Permohonan
          </button>
        </form>
      )}
    </div>
  );
}
