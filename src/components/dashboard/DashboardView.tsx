"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Stats } from "@/lib/stats";

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
    { label: "Fitur Belum Diuji", value: stats?.summary.fitur_belum_diuji ?? "—", top: "bg-neutral-300", text: "text-neutral-950" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Ringkasan masa dan hasil pengujian tim{stats?.cycle ? ` · Siklus ${stats.cycle}` : ""}.
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
          <span>{stats?.summary.permohonan_pending} permohonan pengujian ulang menunggu persetujuan Anda.</span>
          <a href="/permohonan" className="text-sm font-semibold underline underline-offset-2">Lihat permohonan</a>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-neutral-800">
              Masa Pengujian ({range} hari terakhir){cycle ? ` — ${cycle}` : ""}
            </h3>
            <div className="flex gap-2 text-xs" role="group" aria-label="Rentang masa pengujian">
              <button onClick={() => changeRange(7)} disabled={loading} aria-pressed={range === 7} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-50 ${range === 7 ? "border-neutral-950 bg-neutral-950 text-white shadow" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950"}`}>7 hari</button>
              <button onClick={() => changeRange(30)} disabled={loading} aria-pressed={range === 30} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-50 ${range === 30 ? "border-neutral-950 bg-neutral-950 text-white shadow" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950"}`}>30 hari</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="label" fontSize={10} interval={2} stroke="#52525b" />
                <YAxis allowDecimals={false} stroke="#52525b" />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#09090b" }} />
                <Bar dataKey="total" fill="#09090b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-neutral-800">
                Hasil Pengujian Bulan Ini
              </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-neutral-700">
            {pieData.map((d) => (
              <span key={d.name}><span className="mr-1 inline-block h-2 w-2 rounded-full border border-neutral-950" style={{ background: d.color }} aria-hidden />{d.name}: {d.value}</span>
            ))}
          </div>
        </div>
      </div>
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
            <a href="/pengujian-baru" className="btn-primary mt-2">Catat Pengujian</a>
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
