# PRD: SITester (Sistem Pencatatan & Kendali Pengujian Tim Tester)

**Versi:** 3.1 · **Diperbarui:** 4 November 2026 · **Stack:** Next.js 16 + Postgres + Vercel
**Status:** Terimplementasi. Dokumen ini adalah satu-satunya sumber spesifikasi produk, aturan bisnis, desain, dan status implementasi.
Dokumen pendamping: `README.md` (setup, deploy, operasi) dan `PANDUAN-PENGGUNAAN.md` (panduan pengguna akhir).

**Riwayat versi:**
- v2.0: form pengujian, retest per (fitur, peran, siklus), approval, dashboard, riwayat, ekspor CSV/PDF, master data, audit, rate limit login.
- v3.0: akun mandiri, import Excel/CSV, notifikasi email/Telegram, Tugas Saya, test case, defect lifecycle, detail fitur, mode cepat, draft form, AI Test, CI/E2E/health, migrasi berversi.
- v3.1: hardening hasil audit 4 Nov 2026 (scope retest per siklus, defect per pemilik, idempotensi submit, bukti privat, PDF server-side, heartbeat & isolasi runner AI). Dokumen perencanaan terpisah dilebur ke sini.

---

## 1. Produk

**Misi:** menggantikan Excel dengan satu alur: **catat hasil → kendalikan retest → pantau kualitas → ekspor laporan**, tetap sederhana untuk tim kecil dan murah (Vercel free + Postgres free).

**Pengguna**
- **Tester** (non-teknis): mencatat hasil uji harian, memilih test case, mengajukan retest, memakai draft & mode cepat, melihat Tugas Saya, mengusulkan fitur, melacak defect yang ia temukan.
- **Ketua Tim**: semua hak tester + approve/reject retest, kelola semua master, verifikasi fitur/defect, import, kelola akun & tautan reset.

**Masalah yang diselesaikan:** pencatatan tersebar di Excel; retest tidak terkendali; tester tidak tahu "apa yang harus saya uji"; defect tidak terlacak; pemulihan akun dan migrasi data manual; laporan tidak konsisten dengan filter.

**Anti-tujuan:** bukan multi-tenant/SSO, bukan diskusi realtime, bukan multi-lampiran (1 gambar + 1 URL), bukan pengganti CI developer, bukan integrasi Jira/Linear, bukan aplikasi native.

**Prinsip:** riwayat append-only; approval hangus setelah dipakai; satu akun satu sesi aktif; pesan Indonesia; status tidak bergantung warna.

---

## 2. Peran

| Role | Hak |
|---|---|
| **Tester** | Catat hasil, ajukan retest, usul fitur (nonaktif sampai diverifikasi), kelola test case & defect miliknya, lihat data sendiri + agregat tim, AI Test, atur akun sendiri |
| **Ketua Tim** | Semua hak tester + approve/reject, lihat semua data, kelola master (proyek, fitur, peran uji, siklus, test case, pengguna), verifikasi fitur & defect, import, audit aktivitas, tautan reset |

Auth: email + password (scrypt), sesi opak di cookie httpOnly (hash SHA-256 di DB), satu sesi aktif per akun.

---

## 3. Fitur

### F1 — Form Pengujian (`/pengujian-baru`)
- Field wajib: tanggal (tidak boleh masa depan), fitur, peran uji, hasil (Pass/Fail/Bug). Siklus dan test case opsional (daftar test case mengikuti fitur).
- **Severity + catatan ≥10 karakter hanya wajib saat Fail/Bug** (progressive disclosure). Lingkungan, expected, actual, bukti dilipat di `<details>`.
- **Draft otomatis** ke `localStorage` per pengguna (`sitester:draft-v3:<userId>`), tombol Pulihkan/Hapus; draft dibersihkan setelah simpan dan pada jalur konfirmasi AI.
- **Mode cepat**: tanggal/peran/siklus diisi sekali, beberapa hasil diantrekan lalu disimpan sekaligus; setiap baris membawa snapshot scope-nya sendiri; error ditampilkan per baris.
- Submit mengirim header `Idempotency-Key`; double-click atau retry jaringan menghasilkan satu sesi (BR-23).
- Bukti: 1 gambar maks 2MB (F14) + 1 URL http(s).
- Live check `GET /api/v1/features/[id]/can-test` (menegakkan scope siklus juga) dan tombol Ajukan Permohonan dengan alasan opsional.

### F2 — Kontrol Retest
- Scope **(fitur, peran, siklus)**; "tanpa siklus" hanya cocok dengan baris tanpa siklus (BR-1).
- Pass terakhir memblokir pengujian biasa; retest butuh approval ketua (BR-2, BR-3). Fail/Bug terakhir boleh diuji ulang tanpa approval (BR-5).
- Approval single-use, kedaluwarsa 7 hari, membawa siklus; permohonan pending kedaluwarsa 7 hari (BR-4, BR-6).
- Approve dan reject bersifat transaksional (`FOR UPDATE`) agar tidak balapan; dua submit bersamaan ke scope yang sama diserialkan lewat advisory lock.
- Ketua dapat memberi catatan saat approve (`retest_approvals.note`).

### F3 — Notifikasi
- In-app (bel + `/notifikasi`) sebagai sumber utama.
- **Email** (SMTP, nodemailer) untuk permohonan baru (ke ketua) dan keputusan (ke tester); **Telegram** opsional untuk ketua.
- Kanal eksternal best-effort: kegagalan tidak menggagalkan transaksi utama.
- Peringatan duplikat uji memakai label **"diuji tester lain sejak kemarin"** karena `tested_at` hanya tanggal.

### F4 — Tugas Saya (di dashboard)
- **Belum saya uji** (fitur aktif dalam lingkup siklus terpilih), **Permohonan saya** (pending, kedaluwarsa dengan badge, disetujui siap retest), **Perlu diverifikasi** (hasil terakhir Fail/Bug / defect terbuka), **Menunggu persetujuan** (ketua).
- Aksi cepat membuka form dengan fitur/siklus terisi. Label dibedakan "tim" vs "saya" untuk tester.

### F5 — Dashboard & Grafik
Statistik per siklus dan rentang 7/30 hari, bar harian, donut hasil, top fitur, banner instruksi + progres lingkup siklus (X dari Y). Query paralel; grafik dimuat lazy.

### F6 — Riwayat (`/riwayat`)
Filter (tanggal, tester [ketua], fitur, hasil, siklus, kata kunci), sort server-side (whitelist: tanggal, fitur, hasil, severity), preset 7 hari/30 hari/bulan ini, filter tersimpan per pengguna, kartu mobile di bawah `md`, paginasi (default 50).

### F7 — Ekspor
- **CSV** (`/api/v1/export/csv`) dan **PDF** (`/api/v1/export/pdf`) mengikuti filter yang sama, maks 5.000 baris.
- PDF dibuat **di server** (jsPDF + autotable, `maxDuration` 60 detik), landscape, header hitam, ringkasan "N dari TOTAL baris". Tombol unduh memanggil route tersebut.

### F8 — Master Data
- Proyek (FK nyata: `features.project_name → projects(name)` ON UPDATE CASCADE, ON DELETE RESTRICT; rename ikut mengubah fitur; hapus diblokir bila dipakai).
- Fitur (nama unik case-insensitive; hapus ditolak bila dipakai riwayat). **Usulan tester disimpan `is_active=false, verified=false`**; ketua memverifikasi lewat `/api/v1/features/[id]/verify` (BR-24).
- Peran uji, Siklus (lingkup fitur via `cycle_features`; kosong = semua fitur; kolom `brief` = instruksi), Pengguna (tidak bisa hapus diri sendiri; reset password; tautan reset).
- Semua perubahan master tercatat di audit.

### F9 — Akun & Pemulihan
- `/lupa-password` (respons selalu generik), `/reset-password?token=…` (token single-use, 24 jam, hash SHA-256, mencabut semua sesi).
- Ketua membuat tautan reset untuk pengguna mana pun (berguna bila SMTP belum diatur).
- Batas: 3 token per email per 15 menit (BR-22).

### F10 — Import Excel/CSV (`/impor`, ketua)
- Template CSV dan XLSX; unggah `.xlsx`/`.csv` maks **2MB** dan **5.000 baris** (`.xls` tidak didukung). Parser: `exceljs`.
- Pilih sheet dan baris header; mapping kolom otomatis + manual, preset mapping tersimpan di perangkat.
- Kolom: Tanggal, Email Tester, Fitur, Hasil, Peran, Siklus, Test Case, Severity, Lingkungan, Diharapkan, Terjadi, Catatan, Bukti URL, Ulang.
- Pratinjau maks 500 baris (valid/error per baris). Unduh error CSV.
- Commit: default all-or-nothing, opsi "lewati baris error"; transaksi + batch insert; **dedupe hash baris**; `import_batches` + audit; Fail/Bug membuat defect (creator = tester baris, tanggal = tanggal uji); tidak mengirim notifikasi; tidak menerapkan aturan retest (append-only).
- Validasi: fitur/peran/siklus aktif, lingkup siklus, test case milik fitur, format tanggal, severity/catatan Fail/Bug, URL http(s). Error DB tidak dibocorkan (pesan generik + `console.error`); file rusak di `import/errors` → 422.

### F11 — Test Case
Tabel `test_cases` (fitur, judul, langkah, expected, aktif), dikelola di `/fitur/[id]` (ketua semua; tester miliknya). Dipilih opsional di form (BR-14).

### F12 — Siklus Hidup Defect (`/defect`)
- Fail/Bug otomatis membuat tepat satu defect `open` per sesi (BR-15).
- Transisi: `open→fixed`, `reopened→fixed`, `fixed→verified|reopened`, `verified→closed|reopened`, `closed→reopened`. `verified` hanya oleh ketua (BR-16).
- Update defect hanya oleh **pembuat atau ketua** (BR-25). Field: judul, severity, assignee, referensi fix, catatan, verified_by/at. Setiap perubahan diaudit.

### F13 — Detail Fitur (`/fitur/[id]`)
Ringkasan, CRUD test case, defect terkait, timeline semua sesi.

### F14 — Keamanan Upload
- Produksi **wajib** `BLOB_READ_WRITE_TOKEN`; tanpa itu unggah ditolak.
- Validasi magic bytes (PNG/JPEG/WebP/GIF); ekstensi ditentukan server.
- Bukti dilayani lewat route proxy ber-auth (`/api/uploads/...`) dengan `nosniff`, `Content-Disposition: inline`, `Cache-Control: private, no-store`. Blob privat dipakai bila store mendukung; store publik memakai URL UUID sebagai fallback. `BLOB_REQUIRE_PRIVATE=1` menolak fallback.

### F15 — Rate Limit & Sesi
- Login: 10 gagal/15 menit per email dan 30 gagal/15 menit per IP → 429 + `Retry-After`. Sukses menghapus hitungan.
- IP dari `x-real-ip`, lalu entri **terakhir** `x-forwarded-for` (satu helper `clientIp` dipakai semua route).
- Login baru mencabut sesi lama (BR-10); reset password mencabut semua sesi.

### F16 — AI Test (`/ai-test`)
- Input: URL target (http/https), tujuan, kriteria berhasil, fitur/peran/siklus, opsi login target per-run (URL login, email/password, instruksi, label field).
- Run `queued` di `ai_test_runs`. Runner eksternal mengambil lewat `GET /api/v1/ai-runs/next` (Bearer token; atomik; run `running` tanpa heartbeat >15 menit kembali ke antrean). Heartbeat `POST /api/v1/ai-runs/[id]/heartbeat` tiap 5 menit. Kuota 3 run aktif per pengguna (advisory lock).
- Saat run dibuat, server memicu `repository_dispatch` GitHub (`ai-run`) bila `GITHUB_DISPATCH_TOKEN` ada; fallback: jadwal tiap 5 menit / manual (`.github/workflows/ai-runner.yml`).
- Runner menjalankan e2e TesterArmy (Chromium + model gratis OpenRouter/Google Gemini; fallback model berurutan via `E2E_MODELS`) dan mengirim hasil + screenshot ke `POST /api/v1/ai-runs/[id]/result`.
- Hasil adalah **draft**: `Konfirmasi` → `/pengujian-baru?ai_run=…` (prefill) → submit memakai aturan retest/approval yang sama. Fitur/peran/siklus sesi harus cocok dengan run; run berstatus `error` tidak bisa dikonfirmasi menjadi defect.
- `runner_log` per run (maks 100.000 karakter, kredensial disamarkan `[redacted]`), dibaca lewat tombol Log.
- Kredensial login per-run terenkripsi AES-256-GCM (`AI_CREDENTIALS_KEY`, wajib di produksi — fail-closed), hanya dikirim ke runner saat diklaim, dihapus saat hasil dikirim. Bila ketiga label login tidak lengkap, agent AI login sendiri dan **password ikut terkirim ke provider model**.
- Isolasi egress runner (`scripts/ai-target-guard.mjs`): endpoint metadata cloud selalu diblokir; IP/host privat hanya bila `AI_RUNNER_ALLOW_PRIVATE_TARGETS=1`; run terblokir = `error` tanpa biaya model. Laporan e2e hilang = `error`, bukan `fail`.
- Token runner: `AI_RUNNER_TOKEN` atau daftar `AI_RUNNER_TOKENS` (beda per host).
- Waspadai prompt injection dari halaman target; pakai akun tester berhak minimal.

---

## 4. Aturan Bisnis

| # | Aturan |
|---|---|
| BR-1 | Scope retest = (fitur, peran, siklus). Pencocokan siklus memakai `IS NOT DISTINCT FROM`: "tanpa siklus" hanya cocok dengan baris tanpa siklus |
| BR-2 | Hasil terakhir Pass dalam scope memblokir pengujian biasa; pengguna harus memilih "Pengujian Ulang" |
| BR-3 | Retest setelah Pass wajib punya approval ketua yang masih berlaku |
| BR-4 | Approval single-use, scope (fitur, peminta, peran, siklus), kedaluwarsa 7 hari sejak disetujui; approval siklus A tidak berlaku di siklus B |
| BR-5 | Hasil terakhir Fail/Bug: uji ulang boleh tanpa approval (dengan peringatan) |
| BR-6 | Satu permohonan pending per (fitur, peran, siklus); ditolak bila hasil terakhir bukan Pass atau sudah ada approval berlaku; pending kedaluwarsa 7 hari |
| BR-7 | Riwayat `test_sessions` append-only (tanpa edit/hapus) |
| BR-8 | Fail/Bug wajib catatan ≥10 karakter + severity; fitur/peran/siklus harus aktif; siklus ber-lingkup menolak fitur di luar lingkup |
| BR-9 | Tester hanya melihat data miliknya (kecuali agregat tim + dropdown master); `user_id` dari tester diabaikan |
| BR-10 | Satu akun satu sesi aktif |
| BR-11 | Token reset password single-use, 24 jam, hanya hash yang disimpan |
| BR-12 | Reset password mencabut semua sesi |
| BR-13 | Import maks 5.000 baris / 2MB, transaksional; dedupe hash baris |
| BR-14 | Test case harus milik fitur yang diuji dan aktif |
| BR-15 | Fail/Bug membuat tepat satu defect `open` per sesi |
| BR-16 | Transisi defect sesuai F12; `verified` hanya ketua |
| BR-17 | PDF dan CSV memakai filter yang sama (maks 5.000 baris) |
| BR-18 | Bukti divalidasi magic bytes; produksi tanpa Blob = tolak |
| BR-19 | Rate limit login: 10/15 menit per email, 30/15 menit per IP |
| BR-20 | Kredensial login target per-run terenkripsi, tidak dikirim ke model bila login deterministik (tiga label lengkap), dihapus saat hasil dikirim |
| BR-21 | Log runner per AI run (maks 100.000 karakter), dapat dibaca pembuat run/ketua, tanpa kredensial |
| BR-22 | Reset password maks 3 token per email per 15 menit; respons selalu generik |
| BR-23 | `Idempotency-Key` unik per pengguna `(user_id, idempotency_key)`; replay mengembalikan sesi yang sama tanpa efek ganda |
| BR-24 | Usulan fitur dari non-ketua `is_active=false, verified=false` sampai diverifikasi ketua |
| BR-25 | Update defect hanya oleh pembuat atau ketua |

---

## 5. Model Data

Migrasi berversi di `db/migrations/0001…0012_*.sql` + tabel `schema_migrations`; `db/schema.sql` = snapshot fresh-install/test (harus disinkronkan setiap ada migrasi baru).

| Kelompok | Tabel |
|---|---|
| Akun | `users`, `sessions`, `login_attempts`, `password_reset_tokens` |
| Master | `projects`, `testing_roles`, `test_cycles`, `cycle_features`, `features`, `test_cases` |
| Pengujian | `test_sessions` (+`test_case_id`, `idempotency_key`), `retest_requests`, `retest_approvals` (keduanya membawa `test_cycle`), `defects` |
| Lainnya | `notifications`, `audit_logs`, `import_batches`, `ai_test_runs` |

Migrasi penting: `0002` auth/reset · `0003` kualitas (test case, defect) · `0004` indeks performa · `0005` import · `0006–0008,0010` AI run (login, log, error) · `0009` retest per siklus · `0011–0012` idempotensi per pengguna.

---

## 6. Non-Fungsional & Operasi

- Guard server di setiap route; pesan validasi Bahasa Indonesia; error DB tidak dikirim mentah ke klien.
- Zona waktu tunggal Asia/Jakarta (`lib/time.ts`).
- Header keamanan (`next.config.ts`): nosniff, referrer same-origin, frame DENY, HSTS, permissions policy.
- Route aplikasi dilindungi `src/proxy.ts` (cek cookie) + guard server di layout/route.
- **CI** (`.github/workflows/ci.yml`): lint, `tsc`, `npm test` (service Postgres), build; job `e2e` (Playwright) dan `e2e-agentic` (TesterArmy). Workflow terpisah `ai-runner.yml` untuk antrean AI Test.
- **Health:** `GET /api/health` (cek DB) + `instrumentation.onRequestError`.
- **Cleanup:** `npm run db:cleanup` (token, permohonan, login_attempts kedaluwarsa). **Backup:** `scripts/backup.sh` mingguan.
- Performa: query paralel, auth+unread satu query, `loading.tsx`, pool `PG_POOL_MAX` kecil di serverless (lihat README).

---

## 7. Desain (monokrom)

Dunia visual: terang, tinta hitam (bukan dark mode). Status dibedakan **label teks + bentuk border**, bukan warna.

**Token:** tinta `#09090b` (aksi primer, judul, sidebar), kertas `#fafafa` + kartu `#fff`, satu skala `neutral-*`. Tidak ada aksen warna (indigo/violet/emerald/rose/amber/sky), gradien, emoji ikon, kicker/eyebrow.

**Status:** `badge-pass` (hitam solid) · `badge-fail` (border-2) · `badge-bug` (border dashed) · `badge-neutral`/`badge-outline`. Grafik: bar `#09090b`; donut `#09090b/#71717a/#d4d4d8` + border hitam; legenda selalu tampil.

**Kelas bersama (`src/app/globals.css`):**
`.card/.card-pad` · `.page-title/.page-subtitle` · `.btn-primary/.btn-dark/.btn-success-solid` (satu aksi utama per halaman) · `.btn-soft` (sekunder) · `.btn-danger-soft` (hanya Tolak) · `.icon-btn` · `.action-link` · `.label/.hint` · `.input/.input-file` · `.table-head/.table-th` + `caption.sr-only` · `.badge` varian · `.alert-ok/err/warn/info` · `.empty-state` (+CTA) · `.skeleton` (hormati `prefers-reduced-motion`) · `.timeline`.

**Aksesibilitas:** semua tombol `min-h-11` (44px) dan `focus-visible` ring hitam; label terasosiasi (`htmlFor`/`id`); radio dalam `fieldset/legend`; `aria-live` untuk area muat; `lang="id"`; belum dibaca = `bg-neutral-100` + titik + badge "Baru".

**Pola halaman:** judul → subjudul; filter dalam `.card` (+ "Atur ulang"); tabel `overflow-x-auto` (kartu di mobile untuk riwayat); form `card-pad` dengan pesan ber-`role`; baris pratinjau import invalid `bg-neutral-100` + daftar error; PDF header `[9,9,11]`.

**Bahasa:** Indonesia untuk non-teknis ("Kata sandi", "Unduh CSV/PDF", "Atur ulang"); istilah domain Pass/Fail/Bug dipertahankan.

**Sidebar:** utama (Dashboard, Pengujian Baru, Riwayat, Fitur, Defect, AI Test, Notifikasi) dan manajemen/ketua (Proyek, Permohonan, Pengguna, Peran Uji, Siklus, Import, Aktivitas).

---

## 8. Status Implementasi

| Gelombang | Isi | Status |
|---|---|---|
| v2 | Fondasi DB+seed, auth+shell, aturan retest murni, master data, form+retest+notifikasi, riwayat+dashboard, ekspor+bukti, test API, rate limit, approval kedaluwarsa, audit log, paginasi, hardening (zona waktu, header, backup), lingkup siklus, master proyek | Selesai |
| v3 | Migrasi berversi, reset password, import, notifikasi eksternal + upload aman, Tugas Saya, test case + detail fitur, defect lifecycle, form v3, riwayat v3, hardening + CI + E2E | Selesai |
| Audit 4 Nov 2026 | Defect hanya pembuat/ketua; semantik "tanpa siklus" tepat sama; retest menyertakan siklus (`0009`); idempotensi per pengguna (`0012`); bukti privat; error DB generik; draft per pengguna; validasi AI run vs sesi; `can-test` menegakkan lingkup; dashboard menampilkan permohonan kedaluwarsa; rate limit forgot-password; advisory lock anti dua Pass; `.env.example`; hapus route mati; transaksi reject retest; PDF server-side; transisi defect diketatkan; batas import 2MB/5.000 baris | Selesai |
| AI Test hardening | Peringatan password ke model; report hilang = `error`; redaksi kredensial di log; kunci kredensial wajib di produksi; heartbeat 5 menit / reclaim 15 menit; token per-runner; kuota anti-balapan; isolasi egress; Blob privat ketat; E2E defect+import; smoke beban; nol warning lint | Selesai |

**Keputusan arsitektur yang perlu diingat**
- Retest/approval memakai scope siklus *tepat sama* (tidak ada wildcard lintas siklus).
- `tested_at` bertipe `date`, sehingga tidak ada klaim "24 jam".
- Import sengaja append-only dan tidak menjalankan aturan retest.
- Target AI Test boleh publik/internal karena browser berjalan di runner, bukan Vercel.
- Jangan membuat `.env` di root; gunakan `.env.local` (dev) dan `.env.neon` (eksplisit per perintah) — lihat README.

**Utang teknis yang diketahui:** `TRANSITIONS` defect diduplikasi di client dan server; PDF belum memetakan guard formula-injection; `clearDraftFor` belum dipanggil saat logout (draft per-pengguna sudah mencegah kebocoran antar akun); `successUrlContains` runner memakai regex mentah; `/proyek` belum ada di `isAppRoute`/`matcher` `src/proxy.ts` (tetap aman lewat guard server).

---

## 9. Verifikasi

Definition of done tiap perubahan:

```bash
npm run lint
npx tsc --noEmit
npm test            # unit + API, butuh Postgres (TEST_DATABASE_URL)
npm run build
npm run test:e2e    # Playwright: 7 skenario (login, proteksi route, lupa password, regresi UI, defect, import)
```

Opsional: `npm run load:smoke` (100 req / 10 konkuren, gate p95 + 0 error). Manual rilis: lupa password → reset → login; import 2 valid + 1 error; Fail → defect open → fixed → verified; PDF = CSV pada filter yang sama; bukti non-gambar ditolak.

---

## 10. Di Luar Cakupan / Backlog

SSO/OAuth, multi-tenant, komentar realtime, multi-lampiran, integrasi Jira/Linear, aplikasi native, import `.xls` lama, import >5.000 baris via unggah langsung ke Blob.
