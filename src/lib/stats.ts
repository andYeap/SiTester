import { query, queryOne } from "@/lib/db";
import { addDays, dayMonthLabel, todayString } from "@/lib/time";

export type StatsRange = 7 | 30;

export type CycleScope = {
  total: number;
  tested: number;
  untested: string[];
};

export type DashboardStats = {
  range: StatsRange;
  cycle: string | null;
  brief: string | null;
  scope: CycleScope | null;
  summary: {
    total_bulan_ini: number;
    fitur_belum_diuji: number;
    permohonan_pending: number;
    pass_bulan_ini: number;
    fail_bulan_ini: number;
  };
  daily: { labels: string[]; values: number[] };
  distribution: { pass: number; fail: number; bug: number };
  perFeature: { name: string; count: string; last_result: string | null }[];
};

export type Stats = DashboardStats;

async function cycleScope(cycle: string | null): Promise<{ featureIds: number[]; brief: string | null }> {
  if (!cycle) return { featureIds: [], brief: null };
  const briefRow = await queryOne<{ brief: string | null }>(
    `SELECT brief FROM test_cycles WHERE name = $1`,
    [cycle],
  );
  const rows = await query<{ feature_id: number }>(
    `SELECT cf.feature_id FROM cycle_features cf
      JOIN test_cycles c ON c.id = cf.cycle_id WHERE c.name = $1`,
    [cycle],
  );
  return { featureIds: rows.map((r) => r.feature_id), brief: briefRow?.brief ?? null };
}


function scoped(
  alias: string,
  isKetua: boolean,
  userId: string,
  cycle: string | null,
  startIndex: number,
): { cond: string; vals: unknown[] } {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = startIndex;
  if (!isKetua) {
    conds.push(`${alias}.user_id = $${i++}`);
    vals.push(userId);
  }
  if (cycle) {
    conds.push(`${alias}.test_cycle = $${i++}`);
    vals.push(cycle);
  }
  return { cond: conds.length > 0 ? `AND ${conds.join(" AND ")}` : "", vals };
}

export async function getDashboardStats(
  userId: string,
  isKetua: boolean,
  range: StatsRange,
  cycle: string | null,
): Promise<DashboardStats> {
  const today = todayString();
  const month = today.slice(0, 7) + "-01";
  const count = (
    extra: string,
    ...params: unknown[]
  ): Promise<number> =>
    queryOne<{ n: string }>(
      `SELECT count(*)::text AS n FROM test_sessions s WHERE 1=1 ${extra}`,
      params,
    ).then((r) => Number(r?.n ?? 0));

  const m = scoped("s", isKetua, userId, cycle, 2);
  const total = await count(
    `AND date_trunc('month', s.tested_at) = date_trunc('month', $1::date) ${m.cond}`,
    month,
    ...m.vals,
  );
  const p = scoped("s", isKetua, userId, cycle, 2);
  const pass = await count(
    `AND s.result='pass' AND date_trunc('month', s.tested_at) = date_trunc('month', $1::date) ${p.cond}`,
    month,
    ...p.vals,
  );
  const f = scoped("s", isKetua, userId, cycle, 2);
  const failBug = await count(
    `AND s.result IN ('fail','bug') AND date_trunc('month', s.tested_at) = date_trunc('month', $1::date) ${f.cond}`,
    month,
    ...f.vals,
  );

  const scopeInfo = await cycleScope(cycle);
  const scopeIds = scopeInfo.featureIds;
  const untested = cycle
    ? await queryOne<{ n: string }>(
        scopeIds.length > 0
          ? `SELECT count(*)::text AS n FROM features f WHERE f.is_active = true
               AND f.id = ANY($2)
               AND NOT EXISTS (SELECT 1 FROM test_sessions s WHERE s.feature_id = f.id AND s.test_cycle = $1)`
          : `SELECT count(*)::text AS n FROM features f WHERE f.is_active = true
               AND NOT EXISTS (SELECT 1 FROM test_sessions s WHERE s.feature_id = f.id AND s.test_cycle = $1)`,
        scopeIds.length > 0 ? [cycle, scopeIds] : [cycle],
      )
    : await queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM features f WHERE f.is_active = true
           AND NOT EXISTS (SELECT 1 FROM test_sessions s WHERE s.feature_id = f.id)`,
        [],
      );

  const scope: CycleScope | null = !cycle
    ? null
    : scopeIds.length === 0
      ? { total: 0, tested: 0, untested: [] }
      : await (async () => {
          const names = await query<{ name: string }>(
            `SELECT f.name FROM features f WHERE f.is_active = true AND f.id = ANY($2)
               AND NOT EXISTS (SELECT 1 FROM test_sessions s WHERE s.feature_id = f.id AND s.test_cycle = $1)
             ORDER BY f.name`,
            [cycle, scopeIds],
          );
          const total = scopeIds.length;
          return { total, tested: total - names.length, untested: names.map((r) => r.name) };
        })();

  const pending = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM retest_requests WHERE status='pending'`,
  );

  const d = scoped("s", isKetua, userId, cycle, 2);
  const startDate = addDays(today, -(range - 1));
  const daily = await query<{ day: string; n: string }>(
    `SELECT s.tested_at::text AS day, count(*)::text AS n FROM test_sessions s
      WHERE s.tested_at >= $1::date ${d.cond}
      GROUP BY s.tested_at`,
    [startDate, ...d.vals],
  );
  const byDate = new Map(daily.map((r) => [r.day, Number(r.n)]));
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const iso = addDays(today, -i);
    labels.push(dayMonthLabel(iso));
    values.push(byDate.get(iso) ?? 0);
  }

  const g = scoped("s", isKetua, userId, cycle, 2);
  const dist = await query<{ result: string; n: string }>(
    `SELECT s.result, count(*)::text AS n FROM test_sessions s
      WHERE date_trunc('month', s.tested_at) = date_trunc('month', $1::date) ${g.cond}
      GROUP BY s.result`,
    [month, ...g.vals],
  );
  const distribution = { pass: 0, fail: 0, bug: 0 };
  for (const r of dist) {
    if (r.result === "pass" || r.result === "fail" || r.result === "bug") {
      distribution[r.result] = Number(r.n);
    }
  }

  const perFeature = cycle
    ? await query<{ name: string; count: string; last_result: string | null }>(
        `SELECT f.name,
                (SELECT count(*)::text FROM test_sessions s WHERE s.feature_id = f.id AND s.test_cycle = $1) AS count,
                (SELECT s2.result FROM test_sessions s2 WHERE s2.feature_id = f.id AND s2.test_cycle = $1 ORDER BY s2.tested_at DESC, s2.id DESC LIMIT 1) AS last_result
           FROM features f WHERE f.is_active = true
           ORDER BY (SELECT count(*) FROM test_sessions s WHERE s.feature_id = f.id AND s.test_cycle = $1) DESC
           LIMIT 10`,
        [cycle],
      )
    : await query<{ name: string; count: string; last_result: string | null }>(
        `SELECT f.name,
                (SELECT count(*)::text FROM test_sessions s WHERE s.feature_id = f.id) AS count,
                (SELECT s2.result FROM test_sessions s2 WHERE s2.feature_id = f.id ORDER BY s2.tested_at DESC, s2.id DESC LIMIT 1) AS last_result
           FROM features f WHERE f.is_active = true
           ORDER BY (SELECT count(*) FROM test_sessions s WHERE s.feature_id = f.id) DESC
           LIMIT 10`,
      );

  return {
    range,
    cycle,
    brief: scopeInfo.brief,
    scope,
    summary: {
      total_bulan_ini: total,
      fitur_belum_diuji: Number(untested?.n ?? 0),
      permohonan_pending: Number(pending?.n ?? 0),
      pass_bulan_ini: pass,
      fail_bulan_ini: failBug,
    },
    daily: { labels, values },
    distribution,
    perFeature,
  };
}
