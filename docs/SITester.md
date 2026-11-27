# SITester — Sistem Pencatatan & Kendali Pengujian

SITester adalah aplikasi web untuk tim QA/SI yang mencatat hasil pengujian manual,
mengelola temuan (defect), dan menjalankan pengujian otomatis berbantuan AI. Fokusnya
bukan menjalankan test runner, melainkan **menjaga jejak pengujian tetap rapi, dapat
diaudit, dan bisa dipertanggungjawabkan**.

Dokumen ini adalah gambaran umum aplikasi. Rincian kebutuhan ada di
[`PRD.md`](../PRD.md), panduan operasional pengguna di
[`PANDUAN-PENGGUNAAN.md`](../PANDUAN-PENGGUNAAN.md), dan cara setup/deploy di
[`README.md`](../README.md).

---

## 1. Masalah yang diselesaikan

Tanpa alat khusus, hasil pengujian biasanya tersebar di spreadsheet dan chat. Akibatnya:

- status sebuah fitur (sudah diuji? lulus? oleh siapa?) sulit dipastikan;
- pengujian ulang (retest) tidak terkontrol dan sering diulang tanpa dasar;
- temuan hilang atau tidak jelas sudah diperbaiki atau belum;
- tidak ada bukti (screenshot, catatan) yang terikat pada hasil uji;
- tidak ada jejak siapa mengubah apa.

SITester menjawabnya dengan satu sumber kebenaran: setiap hasil uji tercatat lengkap
dengan fitur, peran, siklus, bukti, dan pelakunya.

---

## 2. Peran pengguna

| Peran | Hak utama |
|---|---|
| **Tester** | Mencatat hasil uji, mengajukan retest, mengusulkan fitur, menambah test case, mengubah test case/defect miliknya, mengantrekan AI Test miliknya, melihat riwayat sendiri. |
| **Ketua Tim** | Semua hak tester, ditambah: menyetujui/menolak permohonan retest, melihat seluruh riwayat dan AI run, mengelola master (proyek, fitur, pengguna, peran, siklus), memverifikasi fitur/defect, impor massal, melihat log aktivitas, dan mengoreksi/menghapus riwayat. |

Autentikasi memakai email + kata sandi. Sesi disimpan sebagai token opak di cookie
`httpOnly`, berlaku 8 jam (30 hari bila memilih "Ingat saya"), dan **satu akun hanya
punya satu sesi aktif** — login baru mencabut sesi lama.

---

## 3. Alur kerja

### 3.1 Pengujian manual

1. Tester memilih proyek (opsional), fitur, tanggal, peran yang diuji, dan siklus (opsional).
   Memilih siklus yang punya proyek otomatis menyaring daftar fitur ke proyek itu.
2. Hasil dicatat: **Berhasil** (`pass`) atau **Gagal** (`fail`). Untuk Gagal, tingkat
   urgensi wajib: Rendah, Sedang, atau Tinggi (3 tingkat).
3. Bukti gambar (maks 2 MB) dan tautan bukti tersedia langsung di form; keduanya opsional.
4. Form menyimpan draft otomatis dan submit bersifat idempoten (klik ganda tidak
   menghasilkan dua catatan). Jika dua tester menyimpan scope yang sama secara
   bersamaan, hanya satu yang tersimpan; request lain ditolak `409` dan diminta
   memuat ulang.
5. Untuk hasil Gagal, defect dibuat otomatis dan masuk siklus
   `open → fixed → verified → closed` (bisa `reopened`).
6. Hanya ketua tim yang boleh memindahkan defect ke `verified`.

### 3.2 Retest

Retest diajukan per kombinasi **(fitur, peran, siklus)**. **Semua** retest — setelah
hasil Berhasil maupun Gagal — wajib disetujui ketua tim. Persetujuan bersifat sekali
pakai dan berlaku 7 hari, sehingga pengujian ulang selalu punya dasar. Halaman
`/permohonan` memisahkan tab **Menunggu** dan **Riwayat permohonan**. Ketua tim boleh
menyetujui permohonannya sendiri agar tidak terjadi deadlock.

### 3.3 AI Test

Ketua/tester mengantrekan pengujian otomatis dengan menentukan URL target, tujuan,
kriteria keberhasilan, dan **kategori**: fungsional (agent e2e), ketahanan, stress,
atau keamanan dasar. Runner eksternal mengambil antrean lalu:

- kategori fungsional: menjalankan e2e berbantuan model Gemini;
- kategori ketahanan/stress/keamanan: menjalankan probe HTTP deterministik tanpa model
  (laju permintaan, latensi p95, tingkat gagal, dan pemeriksaan header keamanan).

Hasilnya masuk ke halaman **Hasil AI** sebagai draft yang harus dikonfirmasi manusia
lewat form pengujian. **Antrean AI** dan **Hasil AI** adalah halaman terpisah dari form
`/ai-test`. Run yang masih antre dapat dibatalkan atau dihapus sebelum diambil runner;
hasil yang sudah selesai dapat dikonfirmasi, **ditolak** (dibuang tanpa menjadi riwayat),
atau dihapus. Run yang sedang berjalan tidak bisa dihapus sampai selesai, dan menghapus
run yang sudah dikonfirmasi tidak menghapus riwayatnya.
Kredensial target dienkripsi per run dan tidak pernah ditampilkan kembali.

---

## 4. Peta halaman

| Halaman | Akses | Isi |
|---|---|---|
| `/login`, `/lupa-password`, `/reset-password` | publik | Masuk, minta tautan reset, set kata sandi baru |
| `/dashboard` | semua | Statistik, grafik, "Tugas Saya" |
| `/pengujian-baru` | semua | Form pencatatan hasil uji |
| `/riwayat` | semua | Riwayat + filter (termasuk proyek, sumber Manual/AI, dan kategori AI), sort, preset 7/30 hari, ekspor CSV/PDF |
| `/fitur`, `/fitur/[id]` | semua | Daftar fitur; detail: test case, defect, timeline |
| `/defect` | semua | Daftar dan perubahan status defect |
| `/ai-test` | semua | Form pengajuan AI Test |
| `/ai-antrean` | semua | Antrean run AI yang menunggu/sedang berjalan |
| `/ai-hasil` | semua | Hasil run AI: konfirmasi, tolak, hapus, log, galeri screenshot |
| `/notifikasi` | semua | Kotak masuk pribadi (pemberitahuan). Keputusan retest tetap di `/permohonan` |
| `/proyek`, `/permohonan`, `/pengguna`, `/peran`, `/siklus`, `/impor`, `/aktivitas` | ketua tim | Master, persetujuan (tab Menunggu/Riwayat), impor, audit log |

---

## 5. Perlindungan data (hapus & koreksi)

Riwayat pengujian adalah **jejak audit**, jadi penghapusan dibuat konservatif:

- **Riwayat**: hanya ketua tim yang dapat mengoreksi (`result`, `severity`, `environment`,
  `expected`, `actual`, `notes`) atau menghapus. Tanggal, tester, fitur, dan peran tidak
  bisa diubah agar identitas catatan tetap utuh. Setiap perubahan masuk `audit_logs`.
- **Peringatan sebelum hapus**: bila riwayat tertaut ke defect atau sudah dikonfirmasi
  dari AI Test, API menolak dengan `409` dan UI meminta konfirmasi kedua. Setelah
  dikonfirmasi, **hanya satu baris itu** yang dihapus; defect dan AI run tetap ada
  (tautannya menjadi `NULL`). AI run yang tadinya berstatus `confirmed` kembali menjadi
  `completed` agar bisa dikonfirmasi ulang.
- **Hapus massal** hanya ada untuk notifikasi, itupun terbatas pada notifikasi milik
  pengguna yang meminta dan selalu lewat konfirmasi.
- **Defect** berstatus `verified`/`closed` juga butuh konfirmasi kedua.
- **Fitur** tidak bisa dihapus bila sudah punya riwayat/permohonan retest; gunakan
  nonaktifkan (`is_active = false`).
- **Pengguna, peran, siklus** yang sudah dipakai tidak bisa dihapus karena kunci asing
  DB menolaknya (RESTRICT).

Semua operasi hapus/ubah oleh ketua tim tercatat di `/aktivitas` (aktor, target, waktu,
perubahan, IP).

---

## 6. Arsitektur teknis

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 |
| Bahasa | TypeScript |
| Database | PostgreSQL, akses SQL langsung via `pg` (tanpa ORM), migrasi berversi di `db/migrations` |
| Auth | Sesi opak di cookie `httpOnly`, hash kata sandi `scrypt` |
| Bukti | Vercel Blob privat (produksi, isi dienkripsi) atau folder `uploads/` (lokal), diakses lewat proxy ber-auth |
| Ekspor | CSV di server, PDF via `jspdf` + `autotable` |
| Impor | Excel/CSV via `exceljs` (maks 2 MB / 5.000 baris) dengan pratinjau dan dedupe |
| Email/notifikasi | `nodemailer` (SMTP), Telegram opsional, notifikasi in-app |
| Pengujian | Vitest (unit/API), Playwright (E2E), runner AI eksternal |
| Deploy | Vercel (Node runtime) + Neon Postgres |

Struktur penting:

```
src/app/api/v1/**        endpoint REST (auth, fitur, riwayat, defect, AI run, master)
src/app/(app)/**         halaman aplikasi (server component)
src/components/**        komponen klien per domain
src/lib/**               db, auth, aturan bisnis, audit, upload, ekspor
db/migrations/**         migrasi SQL berurutan
db/schema.sql            snapshot skema untuk database uji
scripts/                 runner AI, migrasi, utilitas beban
tests/api/**             uji API terhadap Postgres sungguhan
```

### Tabel inti

`users`, `sessions`, `features`, `test_cases`, `test_sessions`, `defects`,
`test_cycles`, `testing_roles`, `projects`, `retest_requests`, `retest_approvals`,
`ai_test_runs`, `notifications`, `audit_logs`, `import_batches`.

Aturan penting: `test_sessions` menyimpan `result` (`pass|fail`), `severity`
(`low|medium|high`), `evidence_path`, dan rujukan ke fitur/peran/siklus.
`test_cycles.project_name` opsional (kosong = semua proyek), dan
`ai_test_runs.category` menyimpan kategori pengujian AI. `defects.session_id` dan
`ai_test_runs.confirmed_session_id` memakai `ON DELETE SET NULL`.

---

## 7. Konfigurasi

Salin `.env.example` menjadi `.env.local`. Variabel yang paling penting:

- `DATABASE_URL` — koneksi Postgres.
- `APP_URL` — basis URL untuk tautan email.
- `EVIDENCE_ENCRYPTION_KEY` — wajib bila memakai Vercel Blob (isi bukti dienkripsi).
- `BLOB_READ_WRITE_TOKEN` — penyimpanan bukti di produksi.
- `SMTP_*`, `TELEGRAM_*` — notifikasi keluar (opsional).
- `AI_RUNNER_TOKEN`, `AI_CREDENTIALS_KEY`, `GITHUB_DISPATCH_TOKEN` — integrasi runner AI.
- `E2E_PROVIDER`, `E2E_MODEL`, `E2E_MODELS` — model runner. Untuk kuota hemat:
  `E2E_PROVIDER=google` dan `E2E_MODELS=gemini-3.5-flash-lite`.
- `AI_ENDURANCE_SECONDS` (default 30), `AI_STRESS_REQUESTS` (default 60),
  `AI_STRESS_CONCURRENCY` (default 10) — ambang probe non-fungsional.

---

## 8. Menjalankan dan menguji

```bash
npm install
npm run db:migrate          # memakai DATABASE_URL dari .env.local
npm run dev                 # http://localhost:3000

npm run test:api            # Vitest terhadap Postgres uji
npm run test:e2e            # Playwright
npm run lint && npx tsc --noEmit
```

Uji API membutuhkan `TEST_DATABASE_URL` yang menunjuk database berakhiran
`testlab_test` (aman untuk operasi destruktif). Migrasi ke database Neon memakai
`node --env-file=.env.neon scripts/migrate.mjs`.

---

## 9. Batasan yang diketahui

- Riwayat bersifat append-only secara desain; koreksi hanya untuk ketua tim.
- Penghapusan riwayat tidak memiliki undo — hanya jejak di `audit_logs`.
- AI Test bergantung pada runner eksternal dan kuota model; hasilnya selalu draft.
- Ekspor PDF dibatasi 5.000 baris per unduhan.
- Belum ada bulk-delete riwayat atau pemulihan (restore) data yang terhapus.
