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

  async function reload(nextRange: 7 | 30, nextCycle: string) {
    const sp = new URLSearchParams({ range: String(nextRange) });
    if (nextCycle) sp.set("cycle", nextCycle);
    const res = await fetch(`/api/v1/dashboard/stats?${sp}`);
    if (!res.ok) {
      setError("Gagal memuat statistik.");
      return;
    }
    setStats((await res.json()) as Stats);
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
        { name: "Pass", value: stats.distribution.pass, color: "#16a34a" },
        { name: "Fail", value: stats.distribution.fail, color: "#dc2626" },
        { name: "Bug", value: stats.distribution.bug, color: "#f97316" },
      ]
    : [];

  const cards = [
    { label: "Pengujian Bulan Ini", value: stats?.summary.total_bulan_ini ?? "—", accent: "from-indigo-500 to-violet-500", text: "text-slate-900" },
    { label: "Pass Bulan Ini", value: stats?.summary.pass_bulan_ini ?? "—", accent: "from-emerald-500 to-teal-500", text: "text-emerald-600" },
    { label: "Fail / Bug Bulan Ini", value: stats?.summary.fail_bulan_ini ?? "—", accent: "from-rose-500 to-orange-500", text: "text-rose-600" },
    { label: "Fitur Belum Diuji", value: stats?.summary.fitur_belum_diuji ?? "—", accent: "from-slate-500 to-slate-700", text: "text-slate-900" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Ringkasan masa dan hasil pengujian tim{stats?.cycle ? ` · Siklus ${stats.cycle}` : ""}.
        </p>
      </div>
      {error && <div className="alert-err">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card relative overflow-hidden p-5">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} aria-hidden />
            <div className="text-sm font-medium text-slate-500">{c.label}</div>
            <div className={`mt-1 text-3xl font-extrabold tracking-tight ${c.text}`}>{c.value}</div>
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
        <label className="text-sm font-medium text-slate-600">Siklus</label>
        <select value={cycle} onChange={(e) => changeCycle(e.target.value)} className="rounded-xl border-slate-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">Semua siklus</option>
          {initialCycles.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-700">
              Masa Pengujian ({range} hari terakhir){cycle ? ` — ${cycle}` : ""}
            </h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => changeRange(7)} className={`rounded-full px-3 py-1 font-semibold transition ${range === 7 ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>7 hari</button>
              <button onClick={() => changeRange(30)} className={`rounded-full px-3 py-1 font-semibold transition ${range === 30 ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>30 hari</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="label" fontSize={10} interval={2} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-slate-700">Hasil Pengujian Bulan Ini</h3>
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
          <div className="mt-2 flex justify-center gap-4 text-xs text-gray-600">
            {pieData.map((d) => (
              <span key={d.name}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}: {d.value}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-700">Fitur Paling Sering Diuji</h3>
        <div className="space-y-3">
          {(stats?.perFeature ?? []).map((f) => (
            <div key={f.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-800">{f.name}</span>
                {f.last_result ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${f.last_result === "pass" ? "bg-green-100 text-green-700" : f.last_result === "fail" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                    {f.last_result.toUpperCase()}
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Belum diuji</span>
                )}
              </div>
              <span className="text-gray-500">{f.count}x</span>
            </div>
          ))}
          {(stats?.perFeature.length ?? 0) === 0 && <p className="text-sm text-gray-500">Belum ada data fitur.</p>}
        </div>
      </div>
    </div>
  );
}
