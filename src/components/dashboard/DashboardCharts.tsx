"use client";

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

type DailyPoint = { label: string; total: number };
type PiePoint = { name: string; value: number; color: string };

export default function DashboardCharts({
  dailyData,
  pieData,
  range,
  cycle,
  loading,
  onChangeRange,
}: {
  dailyData: DailyPoint[];
  pieData: PiePoint[];
  range: 7 | 30;
  cycle: string | null;
  loading: boolean;
  onChangeRange: (range: 7 | 30) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-neutral-800">
            Masa Pengujian ({range} hari terakhir){cycle ? ` — ${cycle}` : ""}
          </h3>
          <div className="flex gap-2 text-xs" role="group" aria-label="Rentang masa pengujian">
            <button
              onClick={() => onChangeRange(7)}
              disabled={loading}
              aria-pressed={range === 7}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-50 ${range === 7 ? "border-neutral-950 bg-neutral-950 text-white shadow" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950"}`}
            >
              7 hari
            </button>
            <button
              onClick={() => onChangeRange(30)}
              disabled={loading}
              aria-pressed={range === 30}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-50 ${range === 30 ? "border-neutral-950 bg-neutral-950 text-white shadow" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950"}`}
            >
              30 hari
            </button>
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
        <h3 className="font-semibold text-neutral-800">Hasil Pengujian Bulan Ini</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
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
            <span key={d.name}>
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full border border-neutral-950"
                style={{ background: d.color }}
                aria-hidden
              />
              {d.name}: {d.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
