# PLAN v3 — SITester

Status: **selesai (implementasi v3)**. PRD acuan: `PRD.md` v3. Setiap task selesai bila test/verifikasi terkait hijau.

## Task 1 — Fondasi migrasi berversi + skema v3
- [x] `db/migrations/0001_init.sql` (baseline), `0002_v3_auth_import.sql`, `0003_v3_quality.sql`
- [x] `scripts/migrate.mjs` melacak `schema_migrations`, menjalankan file berurutan
- [x] `db/schema.sql` disinkronkan untuk fresh install/test
- [x] FK `features.project_name → projects(name)`

## Task 2 — Akun & reset password
- [x] `password_reset_tokens`
- [x] `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- [x] `POST /api/v1/users/[id]/reset-link` (ketua)
- [x] Halaman `/lupa-password`, `/reset-password`, tautan di login
- [x] Reset mencabut semua sesi + audit
- [x] Test token kedaluwarsa/single-use

## Task 3 — Import Excel/CSV
- [x] `xlsx` parser + endpoint preview/commit/template
- [x] Validasi per baris (tanggal, email, fitur, peran, siklus, hasil, severity, ulang)
- [x] Halaman `/impor` (ketua) + sidebar
- [x] Commit transaksional; test baris error

## Task 4 — Notifikasi eksternal + upload aman
- [x] `lib/mailer.ts` (SMTP nodemailer) + Telegram opsional
- [x] Notifikasi permohonan/keputusan memakai kanal eksternal (best-effort)
- [x] Upload: magic bytes, produksi wajib Blob, nosniff
- [x] Test upload non-gambar

## Task 5 — Tugas Saya + dashboard
- [x] `myTasks` di stats: belum diuji, permohonan saya, defect terbuka, pending ketua
- [x] Section UI + aksi cepat ke form

## Task 6 — Test case + detail fitur
- [x] `test_cases` + CRUD API
- [x] `test_sessions.test_case_id` + validasi BR-14
- [x] Halaman `/fitur/[id]` (test case, defect, timeline)
- [x] Form memilih test case

## Task 7 — Defect lifecycle
- [x] `defects` + auto-create saat Fail/Bug (BR-15)
- [x] API list/update + halaman `/defect`
- [x] Transisi status + verifikasi ketua (BR-16)
- [x] Tampil di detail fitur & Tugas Saya

## Task 8 — Form v3
- [x] Severity hanya saat Fail/Bug
- [x] Field opsional dilipat
- [x] Draft localStorage + pulihkan/hapus
- [x] Mode cepat (antrean multi-hasil)

## Task 9 — Riwayat v3
- [x] Sort server-side (whitelist)
- [x] Preset 7/30/bulan ini
- [x] Filter tersimpan localStorage
- [x] Kartu mobile
- [x] PDF semua hasil terfilter + palet monokrom
- [x] Catatan saat approve (retest_approvals.note)

## Task 10 — Hardening & rilis
- [x] Rate limit per IP + Retry-After
- [x] `/api/health` + instrumentation error log
- [x] `npm run db:cleanup`
- [x] CI GitHub Actions (lint, tsc, test, build)
- [x] Playwright E2E minimal
- [x] Test suite v3 hijau, build hijau
- [x] Update README
