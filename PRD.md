# PRD: SITester (Sistem Pengujian Tim Tester) — v3

**Versi:** 3.0 · **Tanggal:** 2 November 2026 · **Stack:** Next.js 16 + Postgres + Vercel
**Status:** Terimplementasi & terverifikasi (`75 tests` API/unit, E2E 3 lulus, build hijau) · **Supersedes:** PRD v2.0

**Riwayat perubahan:**
- v2.0: Form pengujian, retest per (fitur, peran, siklus), approval, dashboard, riwayat, ekspor CSV/PDF, master fitur/peran/proyek/siklus/pengguna, audit, multi-sesi login, rate limit.
- v3.0: Akun mandiri (reset password/invite), import Excel/CSV, notifikasi email/Telegram, Tugas Saya, test case per fitur, siklus hidup defect, detail fitur, mode cepat, draft form, riwayat (sort/preset/filter tersimpan/mobile), PDF semua hasil terfilter, keamanan upload, CI/E2E/health, migrasi berversi, normalisasi proyek via FK.

---

## 1. Ringkasan Produk

SITester menggantikan pencatatan pengujian di Excel dengan satu alur: **catat hasil → kendalikan retest → pantau kualitas → ekspor laporan**. v3 menutup celah operasional (akun, migrasi data, notifikasi) dan menaikkan kedalaman QA (test case + defect) tanpa mengorbankan kesederhanaan untuk tim kecil.

### Masalah yang diselesaikan v3
- Pengguna tidak bisa memulihkan password sendiri; semua reset manual oleh ketua.
- Data Excel lama tidak bisa dipindahkan otomatis.
- Permohonan retest hanya terlihat jika ketua membuka aplikasi.
- Tester tidak punya daftar kerja prioritas ("apa yang harus saya uji hari ini").
- Hasil per fitur terlalu kasar untuk QA; tidak ada test case dan status defect.
- PDF hanya memuat halaman riwayat yang sedang dibuka.
- Bukti upload bisa hilang di serverless bila Blob tidak dikonfigurasi.
- Tidak ada CI/E2E/health check; perubahan rawan regresi.

### Sasaran v3
1. Onboarding & pemulihan akun tanpa campur tangan developer.
2. Import data lama dengan pratinjau dan validasi, tanpa mengotori riwayat.
3. Notifikasi sampai ke ketua walau tidak membuka aplikasi.
4. Tester punya antrean tugas yang jelas per siklus.
5. QA bisa mencatat per test case dan melacak defect sampai verified.
6. Laporan PDF identik dengan filter (bukan hanya halaman aktif).
7. Rilis aman: migrasi berversi, CI, E2E, health check.

---

## 2. Peran

| Role pengguna | Hak |
|---|---|
| **Tester** | Catat hasil, ajukan retest, usul fitur, kelola test case & defect yang ia buat, lihat data sendiri + agregat tim, atur akun sendiri |
| **Ketua Tim** | Semua hak tester + approve/reject, lihat semua data, kelola semua master, verifikasi fitur, import, kelola akun & reset link |

Autentikasi tetap email+password (scrypt), sesi opak httpOnly (SHA-256 di DB), satu akun satu sesi aktif. v3 menambah **reset password via token** (24 jam) dan **invite/reset link** dari ketua.

---

## 3. Fitur

### F1 — Form Pengujian (diperbarui v3)
Field wajib tetap. Perubahan:
- **Test Case** (opsional) muncul setelah fitur dipilih; daftar dari master test case fitur tersebut.
- **Severity/triase hanya tampil saat hasil Fail/Bug** (progressive disclosure). Field opsional (lingkungan, expected, actual, bukti) dilipat di `<details>`.
- **Draft otomatis** ke `localStorage` (per pengguna) dengan tombol "Pulihkan"/"Hapus draft".
- **Mode cepat**: tanggal/peran/siklus diisi sekali; penguji menambah beberapa hasil ke daftar lalu menyimpan sekaligus. Error per baris ditampilkan.
- Setelah simpan, tanggal/peran/siklus tetap; fitur/hasil/catatan direset.

### F2 — Kontrol Retest (tidak berubah)
Scope **(fitur, peran, siklus)**; approval single-use + kedaluwarsa 7 hari; Fail/Bug boleh diulang otomatis; pending per (fitur, peran); notifikasi 24 jam.

### F3 — Notifikasi (diperbarui)
- In-app tetap sumber utama (bell + `/notifikasi`).
- **Email** dikirim untuk permohonan baru (ketua) dan keputusan (tester) bila SMTP dikonfigurasi.
- **Telegram** opsional untuk ketua bila `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` diisi.
- Kegagalan kanal eksternal tidak menggagalkan transaksi utama (best-effort + log).

### F4 — Tugas Saya (baru)
Section di dashboard (semua role):
- **Belum saya uji**: fitur aktif dalam lingkup siklus terpilih yang belum saya uji.
- **Permohonan saya**: pending + kedaluwarsa + disetujui (siap retest).
- **Perlu diverifikasi**: fitur dengan hasil terakhir Fail/Bug (defect terbuka).
- **Menunggu persetujuan saya** (ketua): jumlah pending.
Aksi cepat: buka form dengan fitur/siklus terisi.

### F5 — Dashboard & Grafik
Seperti v2 + Tugas Saya. Filter siklus dari master; range 7/30.

### F6 — Riwayat (diperbarui)
- **Sort** server-side: tanggal, fitur, hasil, severity (asc/desc).
- **Preset tanggal**: 7 hari, 30 hari, bulan ini.
- **Filter tersimpan** di localStorage (per pengguna) + tombol terapkan/hapus.
- **Tabel mobile**: kartu per hasil di bawah breakpoint `sm`.
- Kolom tetap; PDF/CSV mengikuti filter.

### F7 — Ekspor (diperbarui)
- CSV mengikuti filter, hingga 5000 baris.
- **PDF mengikuti filter yang sama, bukan halaman aktif**; tombol mengambil seluruh hasil terfilter sebelum membuat PDF.
- PDF memakai palet monokrom (hitam) dan menyertakan ringkasan jumlah baris.

### F8 — Master Data
Fitur/peran/siklus/pengguna seperti v2. Tambahan:
- **Proyek** menjadi FK nyata: `features.project_name → projects(name)` ON UPDATE CASCADE, ON DELETE RESTRICT.
- **Test Case** per fitur: judul, langkah, expected, aktif/nonaktif; dikelola ketua & pembuat.
- **Pengguna**: tombol **Buat tautan reset** (satu kali, 24 jam) dan **Reset password**; tautan ditampilkan untuk disalin.

### F9 — Akun & Pemulihan (baru)
- `/lupa-password`: kirim email berisi tautan reset bila akun ada (respons selalu generik).
- `/reset-password?token=...`: set password baru, cabut semua sesi lama, token single-use.
- Ketua dapat membuat tautan reset untuk pengguna mana pun; berguna bila email belum dikonfigurasi.
- Token disimpan sebagai hash SHA-256, kedaluwarsa 24 jam, tercatat di audit.

### F10 — Import Excel/CSV (v2)
- Halaman `/impor` (ketua) + template **CSV dan XLSX**.
- Unggah **`.xlsx` atau `.csv`**, maks **4MB** dan **20.000 baris** (batas 4MB karena body request Vercel ±4.5MB; `.xls` lama tidak didukung).
- Pilih **sheet** dan **baris header**; **mapping kolom** otomatis + dapat diubah manual, dengan preset mapping tersimpan di perangkat.
- Kolom: Tanggal, Email Tester, Fitur, Hasil, Peran, Siklus, Test Case, Severity, Lingkungan, Diharapkan, Terjadi, Catatan, Bukti URL, Ulang.
- **Pratinjau** maks 500 baris (valid/error per baris, header error, mapping terdeteksi).
- **Commit**:
  - default all-or-nothing; opsi **“lewati baris error”** untuk mengimpor baris valid saja;
  - seluruh baris valid disimpan dalam transaksi, batch insert;
  - **dedupe** lewat hash baris — import ulang file yang sama dilewati, bukan menggandakan;
  - membuat `import_batches` (file, hash, jumlah valid/invalid/imported/skipped, user, waktu) + audit;
  - Fail/Bug membuat defect dengan **creator = tester baris** dan **tanggal = tanggal pengujian**;
  - tidak mengirim notifikasi; tetap append-only.
- **Unduh error CSV** untuk baris invalid.
- Validasi: fitur/peran/siklus aktif, **lingkup fitur siklus**, test case harus milik fitur, format tanggal, severity/catatan Fail/Bug, URL bukti http(s).
- Peringatan duplikat “diuji tester lain” memakai **tanggal pengujian**, bukan waktu import.

### F11 — Test Case (baru)
- Tabel `test_cases`: fitur, judul, langkah, expected, aktif.
- Form pengujian dapat memilih test case (opsional). Hasil per test case memakai kolom expected/actual pada sesi.
- Master test case di halaman detail fitur (ketua dapat mengelola semua; tester mengelola miliknya).

### F12 — Siklus Hidup Defect (baru)
- Hasil **Fail/Bug** otomatis membuat defect (`open`) yang terhubung ke sesi.
- Status: `open → fixed → verified → closed`; juga `reopened`.
- Field: judul, severity, assignee (teks), referensi fix, catatan verifikasi, verified_by/at.
- Halaman `/defect` (semua role) dengan filter status/severity/fitur; ketua/tester dapat memperbarui status (audit).
- Defect terbuka tampil di detail fitur dan Tugas Saya.

### F13 — Detail Fitur (baru)
`/fitur/[id]`: ringkasan fitur, test case (CRUD), defect terkait, dan timeline semua sesi (tanggal, tester, peran, siklus, hasil, severity, bukti).

### F14 — Keamanan Upload (diperbarui)
- Produksi **wajib** `BLOB_READ_WRITE_TOKEN`; tanpa itu unggah ditolak dengan pesan jelas (tidak jatuh ke disk ephemeral).
- Validasi isi file lewat magic bytes (PNG/JPEG/WebP/GIF); ekstensi ditentukan server, bukan nama file.
- Route bukti mengirim `X-Content-Type-Options: nosniff` dan `Content-Disposition: inline`.

### F15 — Rate Limit & Sesi
- Login dibatasi per email **dan** per IP (30 gagal/15 menit), respons 429 + `Retry-After`.
- Tetap satu sesi aktif per akun (BR-10); reset password mencabut semua sesi.

### F16 — AI Test Run
- Halaman `/ai-test`: URL target (http/https), tujuan natural language, kriteria berhasil, fitur/peran/siklus, serta opsi **login target per-run** (URL login, email/password, instruksi, dan label field untuk login deterministik).
- Run `queued` di `ai_test_runs`; runner eksternal mengambil lewat `GET /api/v1/ai-runs/next` dengan Bearer `AI_RUNNER_TOKEN` (atomik; run macet >15 menit dikembalikan ke antrean).
- Saat run dibuat, server memicu `repository_dispatch` GitHub (`ai-run`) bila `GITHUB_DISPATCH_TOKEN` tersedia; tanpa token, schedule/manual menjadi fallback.
- Runner menjalankan e2e TesterArmy (Chromium + model gratis OpenRouter/Google Gemini), mengambil screenshot, lalu `POST /api/v1/ai-runs/{id}/result`.
- Hasil adalah **draft**: user klik `Konfirmasi` → `/pengujian-baru?ai_run=...` (form terisi hasil, severity, catatan, bukti) → submit memakai aturan retest/approval yang sama dan menandai run `confirmed`.
- Target publik/localhost/internal diperbolehkan karena browser berjalan di runner, bukan Vercel.
- Kredensial login target **per-run** disimpan terenkripsi AES-256-GCM di `ai_test_runs.login_credentials_enc`, hanya dikirim ke runner saat run diklaim, tidak masuk prompt/model, dan dihapus saat hasil dikirim. Fallback `AI_TARGET_EMAIL/PASSWORD` hanya dipakai jika run meminta login tanpa kredensial per-run.
- Login deterministik memakai label field (`login_email_label`, `login_password_label`, `login_submit_label`); jika label tidak lengkap, agent AI menjalankan `login_goal`.
- Gratis: runner di VPS/laptop 24 jam atau GitHub Actions terjadwal tiap 5 menit; Vercel hanya antrean/UI.
- Keamanan: token runner wajib sama di Vercel + runner; waspadai prompt injection dari halaman target, gunakan akun tester hak minimal.

---

## 4. Aturan Bisnis (tambahan v3)

| # | Aturan |
|---|---|
| BR-11 | Token reset password single-use, kedaluwarsa 24 jam, hanya hash yang disimpan |
| BR-12 | Reset password mencabut semua sesi pengguna |
| BR-13 | Import hanya commit bila seluruh baris valid; maks 5000 baris; transaksional |
| BR-14 | Test case harus milik fitur yang diuji dan aktif |
| BR-15 | Fail/Bug membuat tepat satu defect `open` per sesi |
| BR-16 | Transisi defect: open→fixed→verified→closed; verified hanya oleh ketua; reopened dari verified/closed |
| BR-17 | PDF mengikuti filter yang sama dengan CSV (semua hasil terfilter, maks 5000) |
| BR-18 | Bukti upload divalidasi magic bytes; produksi tanpa Blob = tolak |
| BR-19 | Rate limit login: 10/15 menit per email, 30/15 menit per IP |
| BR-20 | Kredensial login target per-run disimpan terenkripsi AES-256-GCM, tidak pernah dikirim ke model, dan dihapus saat hasil AI run dikirim |

Aturan BR-1..BR-10 dari v2 tetap berlaku.

---

## 5. Non-Fungsional

- Guard server di setiap route; tester hanya data miliknya (kecuali agregat tim + master dropdown).
- Zona waktu Asia/Jakarta untuk tanggal.
- **Migrasi berversi** di `db/migrations/*.sql` + tabel `schema_migrations`; `db/schema.sql` dipertahankan sebagai snapshot baseline/fresh-install.
- **CI** GitHub Actions: lint, tsc, test API, build; service Postgres.
- **E2E** Playwright minimal: login page, proteksi route, alur login demo.
- **Health** `GET /api/health` (DB check) + `instrumentation.onRequestError` untuk log error terstruktur.
- **Cleanup** `npm run db:cleanup`: hapus token/permohonan/login_attempts kedaluwarsa.
- Header keamanan: nosniff, referrer same-origin, frame DENY, HSTS, permissions policy.
- Backup mingguan tetap.

---

## 6. Out of Scope v3
SSO/OAuth, multi-tenant, komentar diskusi realtime, multi-file attachment, otomasi test runner, integrasi Jira/Linear, mobile app native.

---

## 7. Rencana Implementasi
Lihat `PLAN-v3.md` untuk urutan task dan kriteria selesai.

## 8. Verifikasi v3
- Semua test v2 tetap hijau + regression baru (reset token, import CSV/XLSX, mapping, dedupe, skip-invalid, test case, defect, AI run queue/runner/confirm, sort, rate limit IP, PDF filter, upload magic): **75 test lulus**.
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e` (3 skenario) hijau.
- Manual: lupa password → reset → login; import 2 baris valid + 1 error → commit ditolak; Fail → defect open → verified; PDF filter = CSV filter; bukti non-gambar ditolak.
