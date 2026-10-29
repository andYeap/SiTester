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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pengujian Bulan Ini</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">{stats?.summary.total_bulan_ini ?? "—"}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pass Bulan Ini</div>
          <div className="mt-1 text-3xl font-semibold text-green-600">{stats?.summary.pass_bulan_ini ?? "—"}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Fail / Bug Bulan Ini</div>
          <div className="mt-1 text-3xl font-semibold text-red-600">{stats?.summary.fail_bulan_ini ?? "—"}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Fitur Belum Diuji</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">{stats?.summary.fitur_belum_diuji ?? "—"}</div>
        </div>
      </div>

      {isKetua && (stats?.summary.permohonan_pending ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          <span>{stats?.summary.permohonan_pending} permohonan pengujian ulang menunggu persetujuan Anda.</span>
          <a href="/permohonan" className="text-sm font-medium underline">Lihat permohonan</a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 text-sm shadow-sm">
        <label className="text-gray-600">Siklus</label>
        <select value={cycle} onChange={(e) => changeCycle(e.target.value)} className="rounded-md border-gray-300 text-sm">
          <option value="">Semua siklus</option>
          {initialCycles.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-gray-700">
              Masa Pengujian ({range} hari terakhir){cycle ? ` — ${cycle}` : ""}
            </h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => changeRange(7)} className={`rounded-full px-3 py-1 ${range === 7 ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>7 hari</button>
              <button onClick={() => changeRange(30)} className={`rounded-full px-3 py-1 ${range === 30 ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>30 hari</button>
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
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-medium text-gray-700">Hasil Pengujian Bulan Ini</h3>
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

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-medium text-gray-700">Fitur Paling Sering Diuji</h3>
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
