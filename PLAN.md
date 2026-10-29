# SITester (Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Laravel TestLab menjadi Next.js + Postgres yang deployable di Vercel free, paritas fitur penuh.

**Architecture:** Next.js 16 App Router + `pg` raw SQL (pola lensa-asn: `lib/db.ts` pool, cookie session opaque, guard di server). Aturan retest sebagai fungsi murni di `lib/retest.ts` agar bisa unit-test. Server Components untuk halaman, Route Handlers untuk aksi/JSON.

**Tech Stack:** Next.js 16.4.3, React 19, TypeScript, Tailwind v4, `pg` 8.23.1, recharts, jspdf + jspdf-autotable, vitest.

**Spec:** `PRD.md` (di folder ini; v2 — supersedes `../testlab/PRD-sistem-pengujian-tim.md`).

## Global Constraints

- Node >= 22. LTS.
- Postgres 16 (dev: container `lensa-pg:55432`, db `testlab`; prod: Neon/Supabase free).
- `DATABASE_URL` wajib; pooled usages `PG_POOL_MAX=5` di Vercel.
- Pesan validasi/error Bahasa Indonesia.
- Riwayat append-only: tidak ada edit/hapus `test_sessions`.
- Approval single-use per (fitur, peminta, peran).
- Retest scope = (fitur, peran, siklus); siklus kosong = legacy scope (fitur, peran).

## Review Focus

- Uji peran B tanpa riwayat peran B lolos walau peran A sudah Pass — jangan sampai terblokir.
- Approval peran A dipakai submit peran B harus ditolak.
- `?user_id=` dari tester tetap diabaikan (tidak bocor data orang lain).
- Fitur nonaktif / peran nonaktif / siklus asing ditolak di semua jalur tulis (server).
- Tes pertama di siklus baru lolos; retest Pass dalam siklus yang sama tetap butuh approval.

---

### Task 1: Fondasi DB + seed

**Files:**
- Create: `.env.local` (gitignored), `.env.example`, `db/schema.sql`, `scripts/migrate.mjs`, `src/lib/db.ts`
- Modify: `package.json` (scripts `db:migrate`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `query<T>(text, params?) -> Promise<T[]>`, `queryOne<T>(...) -> Promise<T|null>` in `src/lib/db.ts`; tables + seed rows; `DATABASE_URL` convention (dev: `postgres://lensa:lensa@127.0.0.1:55432/testlab`).

- [x] **Step 1: Write schema** `db/schema.sql` — idempotent (`CREATE TABLE IF NOT EXISTS`); tables `users`, `sessions`, `testing_roles`, `test_cycles`, `features`, `test_sessions`, `retest_requests`, `retest_approvals`, `notifications`; indexes `(feature_id, tested_as_role, tested_at)`, requests `(feature_id, tested_as_role, status)`, `(test_cycle, tested_at)`, `(severity)`; seed `ON CONFLICT DO NOTHING`: roles `super_admin|admin_instansi|tester`, users ketua/tester1-3 (scrypt `password`), 10 fitur contoh, siklus `Lensa-ASN R1`/`R2`.
- [x] **Step 2: Write `scripts/migrate.mjs`** — applies `db/schema.sql` via `DATABASE_URL`.
- [x] **Step 3: Write `src/lib/db.ts`** — pooled `pg` (max `PG_POOL_MAX`, ssl unless local), `query`/`queryOne` (mirror lensa-asn).
- [x] **Step 4: Run** `npm run db:migrate` — Expected: `users` count 4.
- [x] **Step 5: Verify seed** — roles 3, fitur 10, siklus 2.

### Task 2: Auth + shell

**Files:**
- Create: `src/lib/password.ts`, `src/lib/auth.ts`, `src/app/api/auth/login|logout|me/route.ts`, `src/app/login/page.tsx`, `src/components/shell/Shell.tsx`, `src/app/(app)/layout.tsx`, `src/proxy.ts`
- Test: manual (login ketua/tester, guard redirect, logout cabut sesi)

**Interfaces:**
- Consumes: `query/queryOne` (Task 1)
- Produces: `getSessionUser() -> SessionUser|null`, `requireKetua()`, `SESSION_COOKIE='testlab_session'`; `/login`, `/(app)` shell.

- [x] **Step 1: Implement** scrypt password (`scrypt:<salt>:<hash>`), cookie session opaque (mirror lensa-asn), routes login/logout/me, halaman `/login` (pesan Indonesia), `Shell` nav (Dashboard, Pengujian Baru, Riwayat, Fitur; ketua+: Permohonan, Pengguna, Peran Uji, Siklus; bell), `proxy.ts` `/`→`/dashboard` + lindungi `(app)`.
- [x] **Step 2: Verify** — login ketua/tester OK; tester akses halaman ketua → 403/redirect; logout hapus cookie + baris sesi.

### Task 3: Aturan retest murni + unit test

**Files:**
- Create: `src/lib/retest.ts`, `vitest.config.ts`, `src/lib/retest.test.ts`
- Modify: `package.json` (`test` script, devDep `vitest`)

**Interfaces:**
- Consumes: nothing (pure)
- Produces: `canTest(lastResult|null, isRetest, hasApproval) -> {allowed, requiresApproval, warning|null}`.

- [x] **Step 1: Write failing test** — belum diuji→boleh; Pass+non-retest→blokir; Pass+retest tanpa approval→butuh approval; Pass+retest+approval→boleh; Fail/Bug+retest→boleh.
- [x] **Step 2: Run** `npx vitest run` — Expected: FAIL.
- [x] **Step 3: Implement** minimal — Expected: PASS.

### Task 4: Master data (peran, siklus, fitur, pengguna)

**Files:**
- Create: API `api/v1/testing-roles|test-cycles|features|users` (+ `[id]` routes), halaman `(app)/peran|/siklus|/fitur|/pengguna`
- Test: curl/manual (ketua CRUD; tester: fitur create OK, edit/hapus 403; peran/siklus/user 403)

**Interfaces:**
- Consumes: `getSessionUser`, `requireKetua` (Task 2)
- Produces: master JSON + pages; duplikat fitur ditolak case-insensitive; hapus ditolak bila dipakai riwayat; usulan tester `verified=false` + verifikasi ketua.

- [x] **Step 1: Implement** API + pages per aturan di atas (users: cegah hapus diri sendiri).
- [x] **Step 2: Verify** tiap aksi sebagai tester (403 yang seharusnya) dan ketua (OK).

### Task 5: Form pengujian + alur retest + notifikasi

**Files:**
- Create: `(app)/pengujian-baru/page.tsx`, API `test-sessions` POST, `features/[id]/can-test`, `retest-requests` POST + `[id]/approve|reject`, `notifications`, halaman `(app)/permohonan`, `(app)/notifikasi`

**Interfaces:**
- Consumes: `canTest` (Task 3) + lookup last test per (fitur, peran, siklus); konsumsi approval atomik (`SELECT ... FOR UPDATE` dalam transaksi).
- Produces: JSON + pages; notifikasi ketua (permohonan baru) dan tester (keputusan).

- [x] **Step 1: Implement** form 14 field + live check + ajukan permohonan; POST validasi server penuh (aktif semua, notes≥10 + severity bila Fail/Bug, approval bila Pass+retest dalam scope).
- [x] **Step 2: Verify alur** — Pass→blokir→ajukan→setujui→retest lolos + approval terpakai; Fail→langsung; duplikat pending ditolak.

### Task 6: Riwayat + dashboard + grafik

**Files:**
- Create: `(app)/riwayat/page.tsx` (+ API GET filter dari/sampai/user_id/feature/result/q/cycle), `(app)/dashboard/page.tsx` (+ API `dashboard/stats?range&cycle`), grafik recharts (bar 7/30 hari, donut, top fitur)
- Test: manual (isolasi R1 vs R2; tester hanya miliknya; `user_id` orang lain diabaikan) — DONE 29 Okt: curl verified (stats, search q=bayar, halaman 200, scoping tester).

### Task 7: Export + bukti + deploy docs + PRD final

**Files:**
- Create: API `export/csv` (kolom: Tanggal, Tester, Peran, Siklus, Fitur, Hasil, Severity, Lingkungan, Retest, Catatan), unduh PDF client (`jspdf`+autotable), upload bukti (Blob bila token ada else disk lokal + route penyaji), `README.md` (deploy Vercel + Neon), `.env.example`; Modify: `PRD.md` finalisasi status
- Test: manual (CSV cocok filter; PDF terunduh; upload tampil) — DONE 29 Okt: CSV+stats terverifikasi curl, upload file OK, `npm run build` hijau, lint+tsc bersih, vitest 7/7.

### Task 8: Uji API otomatis (vitest + DB terpisah) — DONE
vitest.config + tests/api (auth, retest-flow, masters, rate-limit, approval-expiry, audit-log, pagination) + unit lib (retest, pdf). `npm test` (default DB testlab_test, bisa override via TEST_DATABASE_URL).

### Task 9: Rate limit login — DONE
Maks 10x gagal / 15 menit per email → 429 + pesan Indonesia; sukses menghapus hitungan. Tabel `login_attempts`.

### Task 10: Approval kedaluwarsa — DONE
`retest_approvals.expires_at`, TTL 7 hari sejak approve; lookup abaikan yang kedaluwarsa (NULL = dianggap belum kedaluwarsa, backfill saat migrasi).

### Task 11: Audit log master — DONE
Tabel `audit_logs`; catat create/update/delete fitur, peran, siklus, pengguna (+verify fitur); tanpa password. Halaman `/aktivitas` (ketua) + API filter.

### Task 12: Paginasi riwayat — DONE
API `limit` (default 50, maks 5000 untuk ekspor) + `offset`, respons `{sessions,total,limit,offset}`; UI prev/next + "Menampilkan X–Y dari Z".

### Task 13: PDF satu-klik — DONE
`jspdf`+`autotable` client-side dari data terfilter (di RiwayatTable), nama file `laporan-pengujian-YYYYMMDDHHmmss.pdf`; unit test builder baris + nama file.

### Task 14: Hardening lanjutan — DONE
- Zona waktu tunggal Asia/Jakarta (`lib/time.ts` + test): validasi tanggal, label & window grafik dashboard, default date-picker.
- Permohonan kedaluwarsa 7 hari: kolom `expires_at` di `retest_requests`, diabaikan bila kedaluwarsa (daftar, can-test, ajukan ulang boleh lagi), approve/reject menolak yang kedaluwarsa (410).
- Upload butuh login (`/api/uploads` 401 bila anon).
- Header keamanan di `next.config.ts` (nosniff, referrer, DENY framing, Permissions-Policy, HSTS).
- Backup mingguan: `scripts/backup.sh` (pg_dump via docker, format custom) + restore terverifikasi ke DB kosong; cron mingguan disarankan.
- Satu akun = satu sesi aktif: login baru mencabut sesi lama (`createSession` hapus sesi lama dulu) + test.

## Self-Review

- Spec coverage: auth+roles (T2), retest inti+scope (T3+T5), master 4 entitas (T4), form 14 field (T5), riwayat+filter (T6), dashboard+grafik (T6), export CSV/PDF (T7), notifikasi (T5), seed (T1). Semua BR + perluasan tercakup.
- Review Focus: (1) peran B lolos walau A Pass → T5; (2) approval lintas peran ditolak → T5; (3) `user_id` tester diabaikan → T6; (4) entitas nonaktif ditolak di jalur tulis → T4+T5; (5) siklus baru fresh, retest se-siklus butuh approval → T5.
