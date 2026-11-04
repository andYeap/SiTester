"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import type { Stats } from "@/lib/stats";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-hidden>
      <div className="card space-y-3 p-5 lg:col-span-2">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-64" />
      </div>
      <div className="card space-y-3 p-5">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mx-auto h-48 w-48 !rounded-full" />
        <div className="skeleton h-4 w-32" />
      </div>
    </div>
  ),
});

export default function DashboardView({
  isKetua,
  initialCycles,
  initialStats,
}: {
  isKetua: boolean;
  initialCycles: string[];
  initialStats: Stats;
}) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [range, setRange] = useState<7 | 30>(initialStats.range);
  const [cycle, setCycle] = useState(initialStats.cycle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload(nextRange: 7 | 30, nextCycle: string) {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ range: String(nextRange) });
      if (nextCycle) sp.set("cycle", nextCycle);
      const res = await fetch(`/api/v1/dashboard/stats?${sp}`);
      if (!res.ok) {
        setError("Gagal memuat statistik.");
        return;
      }
      setStats((await res.json()) as Stats);
    } catch {
      setError("Gagal memuat statistik.");
    } finally {
      setLoading(false);
    }
  }

  function changeRange(next: 7 | 30) {
    setRange(next);
    reload(next, cycle).catch(() => setError("Gagal memuat statistik."));
  }

  function changeCycle(next: string) {
    setCycle(next);
    reload(range, next).catch(() => setError("Gagal memuat statistik."));
  }

  const dailyData = (stats?.daily.labels ?? []).map((label, i) => ({
    label,
    total: stats?.daily.values[i] ?? 0,
  }));
  const pieData = stats
    ? [
        { name: "Pass", value: stats.distribution.pass, color: "#09090b" },
        { name: "Fail", value: stats.distribution.fail, color: "#71717a" },
        { name: "Bug", value: stats.distribution.bug, color: "#d4d4d8" },
      ]
    : [];

  const cards = [
    { label: "Pengujian Bulan Ini", value: stats?.summary.total_bulan_ini ?? "—", top: "bg-neutral-950", text: "text-neutral-950" },
    { label: "Pass Bulan Ini", value: stats?.summary.pass_bulan_ini ?? "—", top: "bg-neutral-950", text: "text-neutral-950" },
    { label: "Fail / Bug Bulan Ini", value: stats?.summary.fail_bulan_ini ?? "—", top: "bg-neutral-400", text: "text-neutral-950" },
    { label: "Fitur Belum Diuji" + (isKetua ? "" : " (tim)"), value: stats?.summary.fitur_belum_diuji ?? "—", top: "bg-neutral-300", text: "text-neutral-950" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Ringkasan hasil pengujian {isKetua ? "tim" : "Anda"}{stats?.cycle ? ` · Siklus ${stats.cycle}` : ""}.
        </p>
      </div>
      {error && <div className="alert-err" role="alert">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card relative overflow-hidden p-5">
            <div className={`absolute inset-x-0 top-0 h-1 ${c.top}`} aria-hidden />
            <div className="text-sm font-medium text-neutral-500">{c.label}</div>
            <div className={`mt-1 text-3xl font-extrabold tracking-tight tabular-nums ${c.text}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {isKetua && (stats?.summary.permohonan_pending ?? 0) > 0 && (
        <div className="alert-warn flex items-center justify-between">
          <span>{stats?.summary.permohonan_pending} permohonan pengujian ulang dari tim menunggu persetujuan Anda.</span>
          <Link href="/permohonan" className="text-sm font-semibold underline underline-offset-2">Lihat permohonan</Link>
        </div>
      )}

      {stats?.myTasks && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <h3 className="mb-3 font-semibold text-neutral-800">Belum saya uji</h3>
            {stats.myTasks.untestedFeatures.length === 0 ? (
              <p className="text-sm text-neutral-500">Semua fitur dalam lingkup ini sudah Anda uji.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.myTasks.untestedFeatures.map((f) => (
                  <li key={f.id}>
                    <Link href={`/pengujian-baru?feature=${f.id}${stats.cycle ? `&cycle=${encodeURIComponent(stats.cycle)}` : ""}`}
                      className="action-link min-h-9 px-1"
                    >
                      {f.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold text-neutral-800">Permohonan saya</h3>
            {stats.myTasks.readyApprovals > 0 && (
              <p className="mb-2 inline-flex rounded-full border border-neutral-950 bg-neutral-950 px-3 py-1 text-xs font-semibold text-white">
                {stats.myTasks.readyApprovals} siap diuji ulang
              </p>
            )}
            {stats.myTasks.myPendingRequests.length === 0 ? (
              <p className="text-sm text-neutral-500">Tidak ada permohonan.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.myTasks.myPendingRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-neutral-700">{r.feature_name}</span>
                    {r.expired ? (
                      <span className="badge badge-outline shrink-0 text-[10px] text-neutral-500">Kedaluwarsa</span>
                    ) : (
                      <span className="shrink-0 text-xs text-neutral-500">
                        s.d. {new Date(r.expires_at).toLocaleDateString("id-ID")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold text-neutral-800">Defect terbuka</h3>
            {stats.myTasks.openDefects.length === 0 ? (
              <p className="text-sm text-neutral-500">Tidak ada defect yang perlu ditindak.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.myTasks.openDefects.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <Link href="/defect" className="truncate text-neutral-700 underline-offset-2 hover:underline">
                      {d.feature_name}
                    </Link>
                    <span className="badge badge-outline shrink-0 text-[10px]">{d.status.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label htmlFor="dash-siklus" className="text-sm font-medium text-neutral-600">Siklus</label>
        <select id="dash-siklus" value={cycle} onChange={(e) => changeCycle(e.target.value)} disabled={loading} className="input mt-0 w-auto rounded-xl border-neutral-300 text-sm shadow-sm focus:border-neutral-950 focus:ring-neutral-950">
          <option value="">Semua siklus</option>
          {initialCycles.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span aria-live="polite" className="text-sm text-neutral-400">{loading ? "Memuat…" : ""}</span>
      </div>

      {stats?.cycle && (
        <div className="card space-y-3 p-5" role="region" aria-label={`Ringkasan lingkup ${stats.cycle}`}>
          {stats.brief ? (
            <div className="alert-info">
              <p className="font-semibold">Instruksi {stats.cycle}</p>
              <p className="whitespace-pre-wrap">{stats.brief}</p>
            </div>
          ) : null}
          {stats.scope && stats.scope.total > 0 ? (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-neutral-800">Cakupan siklus: {stats.scope.tested} dari {stats.scope.total} fitur teruji</h3>
                <span className="text-sm tabular-nums text-neutral-500">
                  {stats.scope.total === 0 ? 0 : Math.round((stats.scope.tested / stats.scope.total) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={stats.scope.tested} aria-valuemin={0} aria-valuemax={stats.scope.total} aria-label={`Kemajuan ${stats.cycle}`}>
                <div className="h-full bg-neutral-950 transition-all" style={{ width: `${stats.scope.total === 0 ? 0 : (stats.scope.tested / stats.scope.total) * 100}%` }} />
              </div>
              {stats.scope.untested.length > 0 ? (
                <div className="mt-3">
                  <p className="text-sm font-medium text-neutral-700">Belum diuji di siklus ini:</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {stats.scope.untested.map((n) => (
                      <li key={n} className="badge badge-neutral">{n}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">Semua fitur dalam lingkup sudah diuji.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              Siklus ini mencakup semua fitur aktif — tidak ada daftar khusus.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-hidden>
          <div className="card space-y-3 p-5 lg:col-span-2">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-64" />
          </div>
          <div className="card space-y-3 p-5">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton mx-auto h-48 w-48 !rounded-full" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
      ) : (
        <DashboardCharts
          dailyData={dailyData}
          pieData={pieData}
          range={range}
          cycle={cycle || null}
          loading={loading}
          onChangeRange={changeRange}
        />
      )}

      <div className="card p-5">
        <h3 className="mb-4 font-semibold text-neutral-800">Fitur Paling Sering Diuji</h3>
        {loading ? (
          <div className="space-y-3" aria-hidden>
            <div className="skeleton h-8" />
            <div className="skeleton h-8" />
            <div className="skeleton h-8" />
          </div>
        ) : (stats?.perFeature.length ?? 0) === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></svg></span>
            <p className="empty-title">Belum ada data pengujian</p>
            <p className="empty-hint">Catat hasil pengujian pertama agar grafik dan daftar ini terisi.</p>
            <Link href="/pengujian-baru" className="btn-primary mt-2">Catat Pengujian</Link>
          </div>
        ) : (
        <div className="space-y-3">
          {(stats?.perFeature ?? []).map((f) => (
            <div key={f.name} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-neutral-100">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-900">{f.name}</span>
                {f.last_result ? (
                  <span className={`badge ${f.last_result === "pass" ? "badge-pass" : f.last_result === "fail" ? "badge-fail" : "badge-bug"}`}>
                    {f.last_result.toUpperCase()}
                  </span>
                ) : (
                  <span className="badge badge-neutral">Belum diuji</span>
                )}
              </div>
              <span className="shrink-0 tabular-nums text-neutral-500">{f.count}x</span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
