# PRD: SITester (Sistem Pengujian Tim Tester) — v3

**Versi:** 3.0 · **Tanggal:** 2 November 2026 · **Stack:** Next.js 16 + Postgres + Vercel
**Status:** Terimplementasi & terverifikasi (`68 tests` API/unit, E2E 3 lulus, build hijau) · **Supersedes:** PRD v2.0

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

### F10 — Import Excel/CSV (baru)
- Halaman `/impor` (ketua) + template CSV.
- Unggah `.xlsx`, `.xls`, atau `.csv`; kolom: Tanggal, Email Tester, Peran, Siklus (opsional), Fitur, Hasil, Severity, Lingkungan, Catatan, Ulang (0/1).
- **Pratinjau** maks 500 baris dengan status valid/error per baris (baris, pesan). Tidak ada data ditulis saat pratinjau.
- **Commit** hanya jika 0 error; seluruh baris disimpan dalam satu transaksi. Hasil import **tidak** memicu notifikasi dan tetap append-only.
- File >2MB atau >5000 baris ditolak.

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
- Semua test v2 tetap hijau + regression baru (reset token, import CSV/XLSX, test case, defect, sort, rate limit IP, PDF filter, upload magic): **68 test lulus**.
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e` (3 skenario) hijau.
- Manual: lupa password → reset → login; import 2 baris valid + 1 error → commit ditolak; Fail → defect open → verified; PDF filter = CSV filter; bukti non-gambar ditolak.
