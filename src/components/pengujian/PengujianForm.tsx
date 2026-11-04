"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { todayString } from "@/lib/time";
import { draftKeyFor } from "@/lib/draft";
import FeatureCombobox from "./FeatureCombobox";

type Feature = { id: number; name: string; project_name: string | null; description: string | null };
type Role = { name: string; label: string };
type Cycle = { name: string };
type TestCase = { id: number; title: string };
type Check = {
  allowed: boolean;
  requiresApproval: boolean;
  warning: string | null;
  lastResult: string | null;
  hasPendingRequest: boolean;
  hasPendingRequestOwn: boolean;
  duplicateWarning: string | null;
};

type Draft = {
  testedAt: string;
  isRetest: boolean;
  featureId: string;
  role: string;
  cycle: string;
  testCaseId: string;
  result: string;
  severity: string;
  environment: string;
  expected: string;
  actual: string;
  notes: string;
  evidenceUrl: string;
};

type QueueRow = {
  key: string;
  idemKey: string;
  featureId: string;
  featureName: string;
  testCaseId: string;
  result: string;
  severity: string;
  notes: string;
  testedAt: string;
  isRetest: boolean;
  role: string;
  cycle: string;
  environment: string;
};

type AiRunInitial = {
  id: number;
  targetUrl: string;
  goal: string;
  successCriteria: string | null;
  featureId: number;
  testedAsRole: string;
  testCycle: string | null;
  result: string;
  severity: string | null;
  notes: string | null;
  evidencePath: string | null;
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
  initialProjects,
  initialFeatureId,
  initialCycle,
  initialAiRun,
  userId,
}: {
  initialFeatures: Feature[];
  initialRoles: Role[];
  initialCycles: Cycle[];
  initialProjects: { id: number; name: string }[];
  initialFeatureId?: string;
  initialCycle?: string;
  initialAiRun?: AiRunInitial;
  userId?: string;
}) {
  const [features] = useState<Feature[]>(initialFeatures);
  const [roles] = useState<Role[]>(initialRoles);
  const [cycles] = useState<Cycle[]>(initialCycles);
  const [projectFilter, setProjectFilter] = useState("");
  const [cycleBrief, setCycleBrief] = useState<string | null>(null);
  const [scopeIds, setScopeIds] = useState<number[] | null>(null);
  const projects = useMemo(() => {
    const names = new Set(initialProjects.map((p) => p.name));
    for (const f of features) {
      if (f.project_name && f.project_name.trim() !== "") names.add(f.project_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "id"));
  }, [initialProjects, features]);
  const scopedFeatures = useMemo(
    () => (scopeIds === null ? features : features.filter((f) => scopeIds.includes(f.id))),
    [features, scopeIds],
  );

  const [testedAt, setTestedAt] = useState(today());
  const [isRetest, setIsRetest] = useState(false);
  const [featureId, setFeatureId] = useState(
    initialAiRun ? String(initialAiRun.featureId) : initialFeatureId ?? "",
  );
  const [role, setRole] = useState(
    initialAiRun?.testedAsRole ?? initialRoles[0]?.name ?? "tester",
  );
  const [cycle, setCycle] = useState(
    initialAiRun?.testCycle ?? initialCycle ?? "",
  );
  const [testCaseId, setTestCaseId] = useState("");
  const [result, setResult] = useState(initialAiRun?.result ?? "");
  const [severity, setSeverity] = useState(initialAiRun?.severity ?? "");
  const [environment, setEnvironment] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState(initialAiRun?.notes ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [quickMode, setQuickMode] = useState(false);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [draftAvailable, setDraftAvailable] = useState(false);
  const mounted = useRef(false);
  const router = useRouter();
  const draftKey = useMemo(() => draftKeyFor(userId), [userId]);
  // Satu kunci per upaya simpan: retry/network memakai kunci sama, sukses me-reset.
  const idemRef = useRef<string | null>(null);
  // Edit setelah gagal = operasi baru: kunci lama dibuang agar retry
  // tidak mengembalikan sesi lama dan menghilangkan editan diam-diam.
  // (Double-click tanpa edit tetap memakai kunci yang sama.)
  useEffect(() => {
    if (!saving) idemRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testedAt, featureId, isRetest, role, cycle, testCaseId, result, severity, environment, expected, actual, notes, evidenceUrl]);
  const nextIdemKey = () => {
    if (!idemRef.current) {
      idemRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return idemRef.current;
  };

  const needsTriage = result === "fail" || result === "bug";

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
      /* form tetap bisa dipakai tanpa lingkup */
    }
  }

  async function runCheckWith(fId: string, rt: boolean, rl: string, cyc: string) {
    setCheck(null);
    if (!fId) return;
    const q = new URLSearchParams({
      is_retest: rt ? "1" : "0",
      role: rl,
      cycle: cyc,
    });
    try {
      const res = await fetch(`/api/v1/features/${fId}/can-test?${q}`);
      if (!res.ok) return;
      setCheck((await res.json()) as Check);
    } catch {
      /* abaikan */
    }
  }

  function checkNow(fId = featureId, rt = isRetest, rl = role, cyc = cycle) {
    void runCheckWith(fId, rt, rl, cyc);
  }

  async function loadTestCases(fId: string) {
    setTestCases([]);
    setTestCaseId("");
    if (!fId) return;
    try {
      const res = await fetch(`/api/v1/features/${fId}/test-cases`);
      if (!res.ok) return;
      const data = (await res.json()) as { testCases?: TestCase[] };
      setTestCases(data.testCases ?? []);
    } catch {
      /* opsional */
    }
  }

  // Muat info siklus + cek awal dari query param / hasil AI.
  useEffect(() => {
    const startFeature = initialAiRun
      ? String(initialAiRun.featureId)
      : initialFeatureId;
    const startRole =
      initialAiRun?.testedAsRole ?? initialRoles[0]?.name ?? "tester";
    const startCycle = initialAiRun?.testCycle ?? initialCycle ?? "";

    if (startCycle) void loadCycleInfo(startCycle);
    if (startFeature) {
      void runCheckWith(startFeature, false, startRole, startCycle);
      void loadTestCases(startFeature);
    }
    const raw = localStorage.getItem(draftKey);
    if (raw) setDraftAvailable(true);
    try {
      if (localStorage.getItem("sitester:draft-v3") !== null && draftKey !== "sitester:draft-v3") {
        localStorage.removeItem("sitester:draft-v3");
      }
    } catch {
      /* abaikan */
    }
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan draft otomatis setelah mount.
  useEffect(() => {
    if (!mounted.current) return;
    const draft: Draft = {
      testedAt, isRetest, featureId, role, cycle, testCaseId, result, severity,
      environment, expected, actual, notes, evidenceUrl,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    draftKey,
    testedAt, isRetest, featureId, role, cycle, testCaseId, result, severity,
    environment, expected, actual, notes, evidenceUrl,
  ]);

  // Ganti pengguna: jangan bocorkan draft pengguna lama. Muat draft milik
  // pengguna baru bila ada, sonst reset ke kosong.
  useEffect(() => {
    if (!mounted.current) return;
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      setDraftAvailable(true);
      return;
    }
    setDraftAvailable(false);
    setTestedAt(today());
    setIsRetest(false);
    setFeatureId(initialFeatureId ?? "");
    setRole(initialRoles[0]?.name ?? "tester");
    setCycle(initialCycle ?? "");
    setTestCaseId("");
    setResult("");
    setSeverity("");
    setEnvironment("");
    setExpected("");
    setActual("");
    setNotes("");
    setEvidenceUrl("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function restoreDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Partial<Draft>;
      setTestedAt(d.testedAt ?? today());
      setIsRetest(Boolean(d.isRetest));
      setFeatureId(d.featureId ?? "");
      setRole(d.role ?? role);
      setCycle(d.cycle ?? "");
      setTestCaseId(d.testCaseId ?? "");
      setResult(d.result ?? "");
      setSeverity(d.severity ?? "");
      setEnvironment(d.environment ?? "");
      setExpected(d.expected ?? "");
      setActual(d.actual ?? "");
      setNotes(d.notes ?? "");
      setEvidenceUrl(d.evidenceUrl ?? "");
      if (d.cycle) void loadCycleInfo(d.cycle);
      if (d.featureId) {
        void runCheckWith(d.featureId, Boolean(d.isRetest), d.role ?? role, d.cycle ?? "");
        void loadTestCases(d.featureId);
      }
      setDraftAvailable(false);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }

  function discardDraft() {
    localStorage.removeItem(draftKey);
    setDraftAvailable(false);
  }

  const messages: string[] = [];
  if (check?.warning) messages.push(check.warning);
  if (check?.duplicateWarning) messages.push(check.duplicateWarning);
  if (check?.hasPendingRequestOwn)
    messages.push("Permohonan pengujian ulang Anda untuk fitur ini sedang menunggu persetujuan ketua tim.");

  function buildFormData(row: {
    featureId: string;
    testCaseId?: string;
    result: string;
    severity: string;
    notes: string;
    testedAt?: string;
    isRetest?: boolean;
    role?: string;
    cycle?: string;
    environment?: string;
  }) {
    const fd = new FormData();
    fd.set("tested_at", row.testedAt ?? testedAt);
    fd.set("feature_id", row.featureId);
    fd.set("is_retest", (row.isRetest ?? isRetest) ? "1" : "0");
    fd.set("tested_as_role", row.role ?? role);
    const rowCycle = row.cycle ?? cycle;
    if (rowCycle) fd.set("test_cycle", rowCycle);
    if (row.testCaseId) fd.set("test_case_id", row.testCaseId);
    fd.set("result", row.result);
    if (row.severity) fd.set("severity", row.severity);
    if (row.environment ?? environment) fd.set("environment", row.environment ?? environment);
    if (expected) fd.set("expected", expected);
    if (actual) fd.set("actual", actual);
    if (row.notes) fd.set("notes", row.notes);
    if (evidenceUrl) fd.set("evidence_url", evidenceUrl);
    if (evidenceFile) fd.set("evidence", evidenceFile);
    if (initialAiRun) fd.set("ai_run_id", String(initialAiRun.id));
    return fd;
  }

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
    const idemKey = nextIdemKey();
    try {
      const res = await fetch("/api/v1/test-sessions", {
        method: "POST",
        headers: { "Idempotency-Key": idemKey },
        body: buildFormData({ featureId, testCaseId, result, severity, notes }),
      });
      const data = (await res.json()) as { error?: string; warning?: string | null };
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setOk("Hasil pengujian berhasil disimpan.");
      idemRef.current = null;
      if (data.warning) setWarn(data.warning);
      localStorage.removeItem(draftKey);
      setDraftAvailable(false);
      if (initialAiRun) {
        router.push("/riwayat");
        router.refresh();
        return;
      }
      setResult("");
      setSeverity("");
      setNotes("");
      setExpected("");
      setActual("");
      setEvidenceFile(null);
      setEvidenceUrl("");
      setTestCaseId("");
      checkNow();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  function addToQueue() {
    setQueueError(null);
    if (!featureId) {
      setQueueError("Pilih fitur terlebih dahulu.");
      return;
    }
    if (!result) {
      setQueueError("Pilih hasil pengujian.");
      return;
    }
    if (needsTriage && !severity) {
      setQueueError("Severity wajib untuk Fail/Bug.");
      return;
    }
    if (needsTriage && notes.trim().length < 10) {
      setQueueError("Catatan minimal 10 karakter untuk Fail/Bug.");
      return;
    }
    const f = features.find((x) => String(x.id) === featureId);
    if (!f) return;

    setQueue((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${featureId}`,
        idemKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        featureId,
        featureName: f.name,
        testCaseId,
        result,
        severity,
        notes,
        testedAt,
        isRetest,
        role,
        cycle,
        environment,
      },
    ]);
    setFeatureId("");
    setTestCaseId("");
    setResult("");
    setSeverity("");
    setNotes("");
    setTestCases([]);
    setCheck(null);
  }

  async function saveQueue() {
    setQueueError(null);
    setError(null);
    setOk(null);
    if (queue.length === 0) {
      setQueueError("Daftar masih kosong.");
      return;
    }
    setSaving(true);
    const failed: QueueRow[] = [];
    let success = 0;
    for (const row of queue) {
      try {
        const res = await fetch("/api/v1/test-sessions", {
          method: "POST",
          headers: { "Idempotency-Key": row.idemKey },
          body: buildFormData(row),
        });
        if (!res.ok) {
          failed.push(row);
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!queueError) setQueueError(`${row.featureName}: ${data.error ?? "gagal"}`);
        } else {
          success += 1;
        }
      } catch {
        failed.push(row);
      }
    }
    setQueue(failed);
    setSaving(false);
    if (success > 0) {
      setOk(`${success} hasil tersimpan${failed.length ? `, ${failed.length} gagal` : ""}.`);
      localStorage.removeItem(draftKey);
      setDraftAvailable(false);
    }
  }

  async function requestRetest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const reason = "";
    try {
      const res = await fetch("/api/v1/retest-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_id: Number(featureId),
          tested_as_role: role,
          test_cycle: cycle || null,
          reason: reason || null,
        }),
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Form Pengujian</h1>
          <p className="page-subtitle">Catat hasil uji manual — validasi retest berjalan otomatis.</p>
        </div>
        {!initialAiRun && (
          <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${quickMode ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white text-neutral-800"}`}>
            <input
              type="checkbox"
              checked={quickMode}
              onChange={(e) => { setQuickMode(e.target.checked); setQueueError(null); }}
              className="h-4 w-4 accent-neutral-950"
            />
            Mode cepat
          </label>
        )}
      </div>

      {initialAiRun && (
        <div className="alert-info space-y-2 text-sm" role="status">
          <p className="font-semibold">Hasil AI — review sebelum menyimpan</p>
          <p>
            Target:{" "}
            <a href={initialAiRun.targetUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {initialAiRun.targetUrl}
            </a>
          </p>
          <p>Tujuan: {initialAiRun.goal}</p>
          {initialAiRun.successCriteria && <p>Kriteria berhasil: {initialAiRun.successCriteria}</p>}
          {initialAiRun.evidencePath && (
            <p>
              Bukti:{" "}
              <a
                href={initialAiRun.evidencePath.startsWith("http") ? initialAiRun.evidencePath : `/api/uploads/${initialAiRun.evidencePath}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                lihat screenshot
              </a>
            </p>
          )}
        </div>
      )}

      {draftAvailable && (
        <div className="alert-info flex flex-wrap items-center justify-between gap-2">
          <span>Ada draft pengujian yang belum disimpan.</span>
          <span className="flex gap-3">
            <button type="button" onClick={restoreDraft} className="font-semibold underline underline-offset-2">Pulihkan</button>
            <button type="button" onClick={discardDraft} className="underline underline-offset-2">Hapus</button>
          </span>
        </div>
      )}

      {error && <div className="alert-err" role="alert">{error}</div>}
      {ok && <div className="alert-ok" role="status">{ok}</div>}
      {warn && <div className="alert-warn">{warn}</div>}
      {queueError && <div className="alert-err" role="alert">{queueError}</div>}

      <form onSubmit={quickMode ? (e) => { e.preventDefault(); addToQueue(); } : submit} className="space-y-5 card-pad">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        </div>

        {cycleBrief && (
          <div className="alert-info" role="note">
            <p className="font-semibold">Instruksi {cycle}</p>
            <p className="whitespace-pre-wrap">{cycleBrief}</p>
          </div>
        )}
        {scopeIds !== null && (
          <p className="hint">Siklus ini mencakup {scopeIds.length} fitur — daftar di bawah sudah disaring.</p>
        )}

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
        </div>

        <FeatureCombobox
          id="uji-fitur"
          label="Fitur yang Diuji"
          features={scopedFeatures.map((f) => ({ id: f.id, name: f.name, project: f.project_name, description: f.description }))}
          value={featureId}
          project={projectFilter}
          onChange={(id) => {
            setFeatureId(id);
            checkNow(id, isRetest, role, cycle);
            void loadTestCases(id);
          }}
        />

        {!quickMode && testCases.length > 0 && (
          <div>
            <label className="label" htmlFor="uji-testcase">Test case <span className="font-normal text-neutral-400">(opsional)</span></label>
            <select id="uji-testcase" value={testCaseId} onChange={(e) => setTestCaseId(e.target.value)} className="input">
              <option value="">— Tanpa test case —</option>
              {testCases.map((tc) => (
                <option key={tc.id} value={tc.id}>{tc.title}</option>
              ))}
            </select>
          </div>
        )}

        <div aria-live="polite">
          {check && messages.length > 0 && (
            <div className={!check.allowed ? "alert-err" : "alert-warn"}>
              {messages.map((m, i) => <p key={i}>{m}</p>)}
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
              {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {needsTriage && (
            <div>
              <label className="label" htmlFor="uji-severity">Tingkat Keparahan</label>
              <select id="uji-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} required className="input">
                <option value="">— Pilih tingkat keparahan —</option>
                {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="uji-notes">Catatan</label>
          <p className="hint" id="uji-notes-hint">Wajib minimal 10 karakter bila hasil Fail atau Bug.</p>
          <textarea id="uji-notes" aria-describedby="uji-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} rows={quickMode ? 2 : 4} placeholder="Jelaskan langkah dan hasil yang ditemui…" className="input" />
        </div>

        {!quickMode && (
          <details className="rounded-xl border border-neutral-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-800">
              Detail opsional (lingkungan, expected/actual, bukti)
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="uji-env">Lingkungan</label>
                <input id="uji-env" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="cth: Chrome 126 / Windows 11" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="uji-expected">Yang diharapkan</label>
                <textarea id="uji-expected" value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="uji-actual">Yang terjadi</label>
                <textarea id="uji-actual" value={actual} onChange={(e) => setActual(e.target.value)} rows={2} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="uji-file">Bukti gambar (maks 2MB)</label>
                <input id="uji-file" type="file" accept="image/*" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} className="input-file" />
              </div>
              <div>
                <label className="label" htmlFor="uji-url">atau tautan bukti</label>
                <input id="uji-url" type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://..." className="input" />
              </div>
            </div>
          </details>
        )}

        <button type="submit" disabled={saving || (check !== null && !check.allowed)} className="btn-dark">
          {saving
            ? "Menyimpan..."
            : quickMode
              ? "Tambah ke daftar"
              : initialAiRun
                ? "Konfirmasi & Simpan Hasil AI"
                : "Simpan Hasil Pengujian"}
        </button>
      </form>

      {quickMode && (
        <div className="card-pad space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-neutral-900">Daftar cepat ({queue.length})</h2>
            <button onClick={() => void saveQueue()} disabled={saving || queue.length === 0} className="btn-primary">
              {saving ? "Menyimpan..." : "Simpan semua"}
            </button>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-neutral-500">Tambahkan hasil dari form di atas. Tanggal, peran, dan siklus dipakai untuk semua baris.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {queue.map((row) => (
                <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-neutral-900">{row.featureName}</span>
                    <span className="badge badge-outline ml-2">{row.result.toUpperCase()}</span>
                    {row.severity && <span className="badge badge-neutral ml-1">{row.severity.toUpperCase()}</span>}
                  </span>
                  <button
                    type="button"
                    className="action-link text-xs"
                    onClick={() => setQueue((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!quickMode && check && !check.allowed && check.requiresApproval && (
        <form onSubmit={requestRetest} className="card-pad space-y-4 border-2 border-neutral-950">
          <h3 className="font-semibold text-neutral-950">Ajukan Permohonan Pengujian Ulang</h3>
          <p className="text-sm text-neutral-700">Hasil terakhir untuk kombinasi ini sudah Pass. Permohonan akan dikirim ke ketua tim untuk disetujui sebelum Anda bisa menguji ulang.</p>
          <button className="btn-dark">Kirim Permohonan</button>
        </form>
      )}
    </div>
  );
}
