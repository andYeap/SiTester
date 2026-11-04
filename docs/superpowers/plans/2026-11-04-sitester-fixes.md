# SITester Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki 8 kelompok isu dari HANDOFF-FIXES-SITESTER (retest scope siklus, draft bocor, defect transition, AI runner, import, rate-limit IP, UX pending, gate/idempotency/PDF).

**Architecture:** Migrasi SQL baru untuk kolom `test_cycle` retest; perbaikan query `IS NOT DISTINCT FROM`; perbaikan client key per-user; pengetatan state machine; hardening AI runner + API; penyelarasan limit/dokumen.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Postgres (Neon + lokal 127.0.0.1:55432), Vitest, jsPDF (client saat ini).

**Spec:** `/tmp/commandcode-1000/-home-nganu/8f0eaf87-8657-40e9-a594-5554ea045990/scratchpad/HANDOFF-FIXES-SITESTER.md`

## Global Constraints

- JANGAN buat file `.env` di repo; jangan ubah `.env.local` (berisi DATABASE_URL lokal + kredensial).
- Jangan push secret. Jangan pakai `NODE_ENV=production` saat `npm install`.
- Database lokal `127.0.0.1:55432/testlab` via `docker start lensa-pg`; Neon hanya untuk deploy.
- Perubahan skema via migrasi baru `db/migrations/0009_*.sql` (bukan edit schema saja) + update `db/schema.sql` + `PRD.md` bila aturan bisnis berubah.
- Validasi wajib tiap task: `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build`.

## Review Focus

- Approval Siklus A dipakai di Siklus B harus ditolak (orang mengharap approval lintas siklus berlaku).
- Double-submit form pengujian harus menghasilkan 1 sesi, bukan 2 (retry jaringan).
- Defect `open → closed` langsung harus ditolak; hanya `verified → closed`.
- Draft user A tidak boleh terbaca user B di browser yang sama.
- Kegagalan provider AI tidak boleh dikonfirmasi jadi defect (harus status error).

---

### Task 1: Scope approval retest mencakup siklus (BR-1 s.d. BR-4)

**Files:**
- Create: `db/migrations/0009_retest_cycle.sql`
- Modify: `db/schema.sql:91-114` (tambah `test_cycle` di 2 tabel), `src/app/api/v1/test-sessions/route.ts:202-250`, `src/app/api/v1/features/[id]/can-test/route.ts`, `src/app/api/v1/retest-requests/route.ts`, `src/app/api/v1/retest-requests/[id]/approve/route.ts`
- Test: `tests/api/retest-flow.test.ts`, `tests/api/approval-expiry.test.ts`

**Interfaces:**
- Consumes: `test_sessions.test_cycle text REFERENCES test_cycles(name)`, `canTest()` di `src/lib/retest.ts`
- Produces: kolom baru `retest_requests.test_cycle text`, `retest_approvals.test_cycle text`; semua lookup approval memakai `test_cycle IS NOT DISTINCT FROM $n`

- [ ] **Step 1: Tulis test gagal — approval Siklus A tidak berlaku di Siklus B**
- [ ] **Step 2: Jalankan test, pastikan gagal** — Run: `npm run test:api -- tests/api/retest-flow.test.ts` Expected: FAIL
- [ ] **Step 3: Buat migrasi `0009_retest_cycle.sql`** — `ALTER TABLE retest_requests ADD COLUMN IF NOT EXISTS test_cycle text REFERENCES test_cycles(name) ON UPDATE CASCADE;` sama untuk `retest_approvals`; tambah index `(feature_id, tested_as_role, status, test_cycle)` dan `(feature_id, requested_by, scope_role, test_cycle)`; update `db/schema.sql`
- [ ] **Step 4: Perbaiki 4 file API** — semua `SELECT retest_approvals` tambah `AND test_cycle IS NOT DISTINCT FROM $n`; `SELECT retest_requests pending` tambah filter cycle; `INSERT retest_requests` + `INSERT retest_approvals` simpan `test_cycle` dari body/form (`test_cycle` nullable, validasi `test_cycles` aktif bila diisi)
- [ ] **Step 5: Jalankan migrasi lokal + test** — Run: `npm run db:migrate && npm run test:api` Expected: PASS
- [ ] **Step 6: Update PRD.md BR-1/BR-2/BR-4 bila menyimpang**
- [ ] **Step 7: Commit** — `git add db/migrations/0009_retest_cycle.sql db/schema.sql src/app/api/v1/test-sessions/route.ts "src/app/api/v1/features/[id]/can-test/route.ts" src/app/api/v1/retest-requests/route.ts tests/ && git commit -m "fix(retest): scope approval mencakup test_cycle"`

### Task 2: Draft form per-pengguna

**Files:**
- Modify: `src/components/pengujian/PengujianForm.tsx:65,223-272,343,426`
- Test: manual + unit bila ada (`grep` komponen test)

**Interfaces:**
- Consumes: prop user identity (tambah `userId?: string`)
- Produces: `drafKeyFor(userId)` helper; `DRAFT_KEY` global dihapus

- [ ] **Step 1: Ubah `DRAFT_KEY` jadi fungsi per-user** — `const draftKeyFor = (uid?: string) => uid ? \`sitester:draft-v3:${uid}\` : "sitester:draft-v3:anon"`; semua `getItem/setItem/removeItem` pakai itu
- [ ] **Step 2: Terima prop `userId`, reset saat ganti user** — `useEffect` on `userId` change: load draft milik user baru; bersihkan tampilan bila kosong
- [ ] **Step 3: Bersihkan saat logout** — panggil helper hapus dari client sebelum `destroySession`/logout (atau efek ganti user)
- [ ] **Step 4: Verifikasi** — Run: `npm run lint && npx tsc --noEmit` Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "fix(form): draft per-pengguna cegah bocor antar user"`

### Task 3: Defect hanya closed dari verified

**Files:**
- Modify: `src/app/api/v1/defects/[id]/route.ts:10-15`, `src/components/.../DefectView.tsx`
- Test: tambah kasus transisi ilegal di `tests/api/` defect test

**Interfaces:**
- Consumes: `TRANSITIONS`, cek `verified hanya ketua` (sudah ada baris 56)
- Produces: `TRANSITIONS = { open: ["fixed"], reopened: ["fixed"], fixed: ["verified","reopened"], verified: ["closed","reopened"], closed: ["reopened"] }` (atau + `rejected` bila diputuskan)

- [ ] **Step 1: Tulis test gagal `open→closed` dan `fixed→closed` ditolak 422**
- [ ] **Step 2: Ketatkan `TRANSITIONS`, update `DefectView.tsx` opsi**
- [ ] **Step 3: Update PRD.md BR-16 + jalankan test**
- [ ] **Step 4: Commit**

### Task 4: Keandalan AI runner

**Files:**
- Modify: `scripts/ai-runner.mjs:104-145`, `src/app/api/v1/ai-runs/[id]/result/route.ts`, `src/app/api/v1/test-sessions/route.ts` (tolak konfirmasi error), `src/components/.../AiRunsView.tsx`, `.github/workflows/ai-runner.yml`
- Test: unit parser status + manual run

**Interfaces:**
- Consumes: `ai_test_runs.status`, `runner_log`, `E2E_MODEL`
- Produces: status `error` untuk `MODEL_PROVIDER_FAILED`/`TEST_TIMEOUT` provider; penolakan konfirmasi defect dari run error; login-success wait; retry/fallback model

- [ ] **Step 1: Login wait** — setelah submit, poll URL/selector sukses up to 30s sebelum `agent.act`; tambah field opsional `login_success_url_contains`/`login_success_selector` bila murah (tanpa migrasi bila bisa via kolom JSON existing, else tambah kolom)
- [ ] **Step 2: Klasifikasi error** — kegagalan provider → `status='error'` bukan `fail`; endpoint result + konfirmasi menolak `error` jadi defect (wajib catatan manual)
- [ ] **Step 3: Retry + fallback model** — `gemini-3.8-flash → gemini-3.6-flash → gemini-2.5-flash` via env/workflow
- [ ] **Step 4: Tombol Log selalu** — `AiRunsView.tsx`: tampilkan disabled + "Log tidak tersedia untuk run lama" bila `has_log=false`
- [ ] **Step 5: Test + commit**

### Task 5: Import large

**Files:**
- Modify: `src/lib/import.ts:12`, `src/app/api/v1/import/commit/route.ts:14`, `PRD.md`, `README.md`, `PANDUAN-PENGGUNAAN.md`
- Test: `tests/api/import*.test.ts` bila ada

**Interfaces:**
- Consumes: `IMPORT_MAX_ROWS`, `maxDuration`
- Produces: batas konsisten (putuskan: 5.000 baris / ≤2MB) atau commit background

- [ ] **Step 1: Samakan batas aman + pesan error konsisten**
- [ ] **Step 2: Samakan dokumentasi PRD/README/PANDUAN**
- [ ] **Step 3: Test + commit**

### Task 6: Rate limit login IP spoofing

**Files:**
- Modify: `src/app/api/auth/login/route.ts:10-11`, `src/lib/audit.ts:3-4`
- Test: unit `clientIp` header prioritas

**Interfaces:**
- Consumes: `clientIp(request)` tunggal
- Produces: login pakai helper `clientIp` dari `audit.ts`; dokumentasi BR-19 disamakan (10 gagal/15 mnt per email, 30 per IP)

- [ ] **Step 1: Hapus fungsi lokal duplikat, pakai `clientIp` dari `audit.ts`; pastikan urutan header sesuai platform (Vercel menimpa `x-forwarded-for`)**
- [ ] **Step 2: Test + commit**

### Task 7: UX permohonan_pending + tombol Log

**Files:**
- Modify: `src/lib/stats.ts:125,318`, dashboard UI label; (Log sudah di Task 4.4)
- Test: cek label

- [ ] **Step 1: Label jelas "menunggu persetujuan tim" atau batasi ke milik sendiri untuk tester**
- [ ] **Step 2: Commit**

### Task 8: Gate fitur, idempotency, PDF server-side

**Files:**
- Modify: `src/app/api/v1/features/route.ts:59,86-98`, `src/app/api/v1/test-sessions/route.ts` (POST), `src/app/api/v1/export/pdf/route.ts` (baru), `src/components/history/DownloadPdfButton.tsx:30-51`
- Test: usulan tester nonaktif; double-submit 1 sesi; export PDF kecil

**Interfaces:**
- Consumes: `user.role`, `features.is_active/verified`
- Produces: `is_active=false` untuk usulan non-ketua; `Idempotency-Key` header dedupe dalam transaksi; route PDF server-side (atau peringatan/paginasi bila tidak memungkinkan)

- [ ] **Step 1: Gate fitur — non-ketua `is_active=false`, ketua aktifkan via `/fitur/[id]/verify`**
- [ ] **Step 2: Idempotency — terima `Idempotency-Key`, cek duplikat dalam transaksi**
- [ ] **Step 3: PDF server-side atau paginasi/peringatan**
- [ ] **Step 4: Full validasi `npm run lint && npm test && npx tsc --noEmit && npm run build` + commit**
