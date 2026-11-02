import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import TestCaseManager from "@/components/features/TestCaseManager";
import { getSessionUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parsePositiveInt } from "@/lib/validation";

type FeatureRow = {
  id: number;
  name: string;
  description: string | null;
  project_name: string | null;
  is_active: boolean;
  verified: boolean;
  creator_name: string | null;
};

type CaseRow = {
  id: number;
  title: string;
  steps: string | null;
  expected: string | null;
  is_active: boolean;
  created_by: string | null;
};

type DefectRow = {
  id: number;
  title: string;
  severity: string | null;
  status: string;
  assignee: string | null;
  created_at: string;
};

type SessionRow = {
  id: number;
  tested_at: string;
  result: string;
  severity: string | null;
  tested_as_role: string;
  test_cycle: string | null;
  notes: string | null;
  is_retest: boolean;
  user_name: string;
  case_title: string | null;
  evidence_path: string | null;
  evidence_url: string | null;
};

const resultBadge = (r: string) =>
  r === "pass" ? "badge-pass" : r === "fail" ? "badge-fail" : "badge-bug";

const defectBadge = (s: string) =>
  s === "verified" ? "badge-pass" : s === "fixed" ? "badge-bug" : "badge-outline";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const featureId = parsePositiveInt((await params).id);
  if (featureId === null) notFound();

  const feature = await queryOne<FeatureRow>(
    `SELECT f.id, f.name, f.description, f.project_name, f.is_active, f.verified,
            u.name AS creator_name
       FROM features f LEFT JOIN users u ON u.id = f.created_by
      WHERE f.id=$1`,
    [featureId],
  );
  if (!feature) notFound();

  const [cases, defects, sessions, stats] = await Promise.all([
    query<CaseRow>(
      `SELECT id, title, steps, expected, is_active, created_by
         FROM test_cases WHERE feature_id=$1 ORDER BY is_active DESC, title`,
      [featureId],
    ),
    query<DefectRow>(
      `SELECT id, title, severity, status, assignee, created_at
         FROM defects WHERE feature_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [featureId],
    ),
    query<SessionRow>(
      `SELECT s.id, s.tested_at::text AS tested_at, s.result, s.severity,
              s.tested_as_role, s.test_cycle, s.notes, s.is_retest,
              u.name AS user_name, tc.title AS case_title,
              s.evidence_path, s.evidence_url
         FROM test_sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN test_cases tc ON tc.id = s.test_case_id
        WHERE s.feature_id=$1
        ORDER BY s.tested_at DESC, s.id DESC LIMIT 100`,
      [featureId],
    ),
    queryOne<{ total: string; pass: string; fail: string; open_defects: string }>(
      `SELECT
         (SELECT count(*)::text FROM test_sessions WHERE feature_id=$1) AS total,
         (SELECT count(*)::text FROM test_sessions WHERE feature_id=$1 AND result='pass') AS pass,
         (SELECT count(*)::text FROM test_sessions WHERE feature_id=$1 AND result IN ('fail','bug')) AS fail,
         (SELECT count(*)::text FROM defects WHERE feature_id=$1 AND status IN ('open','reopened','fixed')) AS open_defects`,
      [featureId],
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/fitur" className="text-sm text-neutral-500 underline-offset-2 hover:underline">
            ← Kembali ke daftar fitur
          </Link>
          <h1 className="page-title mt-1">{feature.name}</h1>
          <p className="page-subtitle">
            {feature.project_name ?? "Tanpa proyek"}
            {feature.description ? ` · ${feature.description}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`badge ${feature.is_active ? "badge-pass" : "badge-neutral"}`}>
            {feature.is_active ? "Aktif" : "Nonaktif"}
          </span>
          <span className={`badge ${feature.verified ? "badge-pass" : "badge-outline"}`}>
            {feature.verified ? "Terverifikasi" : "Usulan baru"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total uji", stats?.total ?? "0"],
          ["Pass", stats?.pass ?? "0"],
          ["Fail/Bug", stats?.fail ?? "0"],
          ["Defect terbuka", stats?.open_defects ?? "0"],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="text-xs font-medium text-neutral-500">{label}</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{value}</div>
          </div>
        ))}
      </div>

      <TestCaseManager
        featureId={feature.id}
        userId={user.id}
        isKetua={user.role === "ketua_tim"}
        initialCases={cases}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-semibold text-neutral-900">Defect</h2>
          <Link href="/defect" className="text-sm text-neutral-600 underline-offset-2 hover:underline">
            Kelola semua defect
          </Link>
        </div>
        {defects.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">Belum ada defect untuk fitur ini.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {defects.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{d.title}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(d.created_at).toLocaleDateString("id-ID")}
                    {d.assignee ? ` · PIC ${d.assignee}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.severity && <span className="badge badge-outline">{d.severity.toUpperCase()}</span>}
                  <span className={`badge ${defectBadge(d.status)}`}>{d.status.toUpperCase()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-neutral-900">Timeline pengujian</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Belum ada sesi pengujian.</p>
        ) : (
          <ol className="timeline">
            {sessions.map((s) => (
              <li key={s.id} className="relative">
                <span className="timeline-dot" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums text-neutral-900">
                    {new Date(s.tested_at).toLocaleDateString("id-ID")}
                  </span>
                  <span className={`badge ${resultBadge(s.result)}`}>{s.result.toUpperCase()}</span>
                  {s.severity && <span className="badge badge-outline">{s.severity.toUpperCase()}</span>}
                  {s.is_retest && <span className="badge badge-neutral">Ulang</span>}
                  <span className="text-neutral-600">{s.user_name}</span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-600">{s.tested_as_role}</span>
                  {s.test_cycle && <span className="text-neutral-500">· {s.test_cycle}</span>}
                </div>
                {s.case_title && <p className="mt-1 text-xs text-neutral-500">Test case: {s.case_title}</p>}
                {s.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{s.notes}</p>}
                <div className="mt-1 flex gap-3 text-xs">
                  {s.evidence_path && (
                    <a
                      href={s.evidence_path.startsWith("http") ? s.evidence_path : `/api/uploads/${s.evidence_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-700 underline underline-offset-2"
                    >
                      Bukti
                    </a>
                  )}
                  {s.evidence_url && (
                    <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-neutral-700 underline underline-offset-2">
                      Tautan bukti
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
