# PRD: SITester (Sistem Pencatatan & Kendali Pengujian Tim Tester)

**Versi:** 3.2 · **Diperbarui:** 4 November 2026 · **Stack:** Next.js 16 + React 19 + Postgres + Vercel
**Status:** Terimplementasi. Dokumen ini diverifikasi terhadap kode pada HEAD `c9fabbb` (lihat bagian 10).

PRD ini adalah **satu-satunya sumber** spesifikasi produk, aturan bisnis, desain, dan status implementasi. Dokumen pendamping:
- `README.md` — setup lokal, variabel lingkungan, deploy, operasi, AI runner.
- `PANDUAN-PENGGUNAAN.md` — panduan untuk tester dan ketua tim.
- `AGENTS.md` — aturan untuk agen kode (Next.js versi ini punya breaking change; baca `node_modules/next/dist/docs/` sebelum mengubah kode).

---

## 1. Produk

**Misi:** menggantikan Excel dengan satu alur — **catat hasil → kendalikan retest → pantau kualitas → ekspor laporan** — tetap sederhana untuk tim kecil dan murah (Vercel free + Postgres free).

**Pengguna**
- **Tester** (non-teknis): mencatat hasil uji harian, memilih test case, mengajukan retest, memakai draft & mode cepat, melihat Tugas Saya, mengusulkan fitur, menjalankan AI Test.
- **Ketua Tim**: semua hak tester + menyetujui/menolak retest, mengelola master, memverifikasi fitur, mengimpor data, mengelola akun, melihat audit.

**Masalah yang diselesaikan:** pencatatan tersebar di Excel; retest tidak terkendali; tester tidak tahu apa yang harus diuji; temuan tidak terlacak; pemulihan akun dan migrasi data manual; laporan tidak konsisten dengan filter.

**Anti-tujuan:** bukan multi-tenant/SSO, bukan diskusi realtime, bukan multi-lampiran (1 gambar + 1 URL), bukan integrasi Jira/Linear, bukan aplikasi native.

**Prinsip:** riwayat append-only; approval hangus setelah dipakai; satu akun satu sesi aktif; pesan Indonesia; status tidak bergantung pada warna.

**Riwayat versi**
- v2.0: form pengujian, retest per (fitur, peran, siklus), approval, dashboard, riwayat, ekspor CSV/PDF, master data, audit, rate limit login.
- v3.0: akun mandiri, import Excel/CSV, notifikasi email/Telegram, Tugas Saya, test case, defect lifecycle, detail fitur, mode cepat, draft form, AI Test, CI/E2E/health, migrasi berversi.
- v3.1: hardening audit 4 Nov 2026 (scope retest per siklus, update defect per pemilik, idempotensi submit, bukti privat, PDF server-side, heartbeat & isolasi runner AI); dokumen perencanaan dilebur ke PRD.
- v3.2: PRD/README/panduan diselaraskan ulang dengan kode (koreksi Tugas Saya, riwayat, notifikasi, audit, sesi "Ingat saya", operasi); perbaikan inkonsistensi kecil di kode (`/proyek` di proxy, filter aksi audit lengkap, default model Google seragam `gemini-3.6-flash`, emoji dashboard dihapus).

---

## 2. Peran & Halaman

| Role | Hak |
|---|---|
| **Tester** | Catat hasil, ajukan retest, usul fitur (nonaktif sampai diverifikasi), tambah test case, ubah test case/defect miliknya, AI Test miliknya, lihat riwayat sendiri |
| **Ketua Tim** | Semua hak tester + approve/reject, lihat semua riwayat dan semua AI run, kelola master, verifikasi fitur/defect, import, audit, tautan reset |

Auth: email + password (scrypt `scrypt:<salt>:<hash>`), sesi opak di cookie httpOnly `testlab_session` (SHA-256 token di tabel `sessions`), `SameSite=Lax`, `Secure` di produksi. **Durasi sesi 8 jam; dengan "Ingat saya" 30 hari.** Satu akun satu sesi aktif.

| Halaman | Akses | Isi |
|---|---|---|
| `/login`, `/lupa-password`, `/reset-password` | publik | Masuk (+Ingat saya), minta tautan reset, set password baru |
| `/dashboard` | semua | Statistik, grafik, Tugas Saya |
| `/pengujian-baru` | semua | Form pengujian (juga tujuan konfirmasi AI run: `?ai_run=`) |
| `/riwayat` | semua | Riwayat, filter, ekspor |
| `/fitur`, `/fitur/[id]` | semua (aksi master: ketua) | Daftar/usul fitur; detail: test case, defect, timeline |
| `/defect` | semua | Daftar & status defect |
| `/ai-test` | semua | Antrean AI Test |
| `/notifikasi` | semua | Notifikasi in-app |
| `/proyek`, `/permohonan`, `/pengguna`, `/peran`, `/siklus`, `/impor`, `/aktivitas` | **ketua** (selain itu redirect ke `/dashboard`) | Master & administrasi |


---

## 3. Fitur

### F1 — Form Pengujian (`/pengujian-baru`)
- Urutan field: tanggal (tidak boleh masa depan) → "Apakah ini pengujian ulang?" (radio Tidak/Ya) → peran uji + siklus → filter proyek → **fitur (combobox pencarian, dikelompokkan per proyek)** → test case (opsional, hanya mode biasa) → status hasil (Pass/Fail/Bug) → tingkat keparahan → catatan.
- Memilih siklus yang punya lingkup menyaring daftar fitur dan menampilkan instruksi siklus (`brief`).
- **Severity hanya tampil saat Fail/Bug; Fail/Bug wajib severity + catatan ≥10 karakter** (BR-8). Lingkungan, expected, actual, bukti gambar (maks 2MB), dan tautan bukti dilipat di `<details>`.
- **Live check** `GET /api/v1/features/[id]/can-test` setiap fitur/peran/siklus/retest berubah: menampilkan blokir, peringatan, atau "siap diuji"; juga peringatan "baru diuji tester lain sejak kemarin". Bila retest butuh approval, muncul kartu **Ajukan Permohonan** (alasan opsional, maks 1000 karakter).
- **Draft otomatis** ke `localStorage` kunci `sitester:draft-v3:<userId>` + banner Pulihkan/Hapus; dibersihkan setelah simpan (termasuk jalur konfirmasi AI). Kunci lama tanpa pengguna dihapus.
- **Mode cepat**: antrean hasil dengan tanggal/peran/siklus/retest/lingkungan dari saat baris ditambahkan; tombol "Simpan semua" mengirim satu per satu, baris gagal tetap di daftar dengan pesan error.
- Setelah simpan tunggal: tanggal/retest/peran/siklus tetap; fitur, hasil, severity, catatan, expected/actual, bukti, test case direset.
- Submit mengirim `Idempotency-Key` (UUID per submit; per baris di mode cepat); double-click atau retry menghasilkan satu sesi (BR-23).
- **Konfirmasi AI** (`?ai_run=ID`): form terisi dari run (fitur, peran, siklus, hasil, severity, catatan, bukti), submit menandai run `confirmed`, lalu diarahkan ke `/riwayat`.
- Parameter URL `?feature=ID&cycle=NAMA` mengisi awal form (dipakai aksi cepat Tugas Saya).

### F2 — Kontrol Retest
- Scope **(fitur, peran, siklus)**; "tanpa siklus" hanya cocok dengan sesi tanpa siklus (BR-1).
- Hasil terakhir Pass memblokir pengujian biasa; retest wajib approval ketua (BR-2/3). Hasil terakhir Fail/Bug boleh diuji tanpa approval (BR-5), dengan peringatan bila bukan retest.
- Permohonan: satu pending per (fitur, peran, siklus); ditolak bila hasil terakhir bukan Pass atau sudah ada approval berlaku; kedaluwarsa 7 hari (BR-6).
- Ketua: **Setujui** (catatan opsional → `retest_approvals.note`) atau **Tolak** (alasan **wajib**). Approval single-use, kedaluwarsa 7 hari sejak disetujui (BR-4).
- Approve/reject transaksional (`FOR UPDATE`); dua submit bersamaan ke scope yang sama diserialkan lewat `pg_advisory_xact_lock`; approval dikonsumsi atomik (`used_at`).
- Halaman `/permohonan`: daftar menunggu + 20 riwayat keputusan terakhir.

### F3 — Notifikasi
- In-app: bel di topbar dan `/notifikasi` (50 terbaru; tandai dibaca satu/semua).
- Hanya dua jenis: `retest_request` (ke **semua ketua** saat permohonan baru) dan `retest_decided` (ke tester saat disetujui/ditolak). **Perubahan status defect dan import tidak mengirim notifikasi.**
- Email (SMTP, nodemailer) dikirim ke setiap penerima notifikasi bila `SMTP_HOST` + `SMTP_FROM` diset; Telegram (bot) hanya untuk notifikasi ke ketua bila `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` diset. Tautan memakai `APP_URL` bila ada.
- Kanal eksternal best-effort: kegagalan hanya dicatat, tidak menggagalkan transaksi.

### F4 — Dashboard & Tugas Saya (`/dashboard`)
- Kartu bulan berjalan: Pengujian, Pass, Fail/Bug (dibatasi ke data sendiri untuk tester, seluruh tim untuk ketua) dan **Fitur Belum Diuji** (fitur aktif yang belum punya sesi dari siapa pun — dalam siklus/lingkup bila siklus dipilih; label "(tim)" untuk tester).
- Filter siklus + rentang 7/30 hari; bar harian, donut hasil bulan ini (Pass/Fail/Bug), daftar 10 fitur paling sering diuji dengan badge hasil terakhir.
- Siklus terpilih: kotak instruksi (`brief`) + progres lingkup "X dari Y fitur teruji" + daftar belum diuji (bila siklus punya lingkup).
- Banner khusus ketua bila ada permohonan pending (dengan tautan ke `/permohonan`).
- **Tugas Saya** (tiga kartu):
  1. **Belum saya uji** — fitur aktif (dalam lingkup siklus bila dipilih) yang belum pernah **saya** uji; maks 20; tautan membuka form dengan fitur/siklus terisi.
  2. **Permohonan saya** — permohonan pending (badge "Kedaluwarsa" bila lewat) + lencana "N siap diuji ulang" untuk approval yang belum dipakai.
  3. **Defect terbuka** — 10 defect berstatus `open`/`reopened`/`fixed` (semua pengguna), urut severity.

### F5 — Riwayat (`/riwayat`)
- Filter: pencarian (catatan/fitur/tester), dari/sampai tanggal, fitur, hasil, siklus. API juga menerima `user_id` (hanya berlaku untuk ketua; tester selalu dibatasi data sendiri — BR-9).
- **Sort server-side lewat dropdown** (whitelist 8 opsi): tanggal terbaru/terlama, fitur A–Z/Z–A, hasil A–Z/Z–A, severity tertinggi/terendah.
- Preset tanggal **7 hari** dan **30 hari**; **Simpan filter / Hapus tersimpan** (localStorage `sitester:riwayat-filters`, dipulihkan saat halaman dibuka).
- Tabel di ≥`md`, kartu per hasil di bawahnya; paginasi 50 baris; kolom Tester hanya untuk ketua; kolom bukti (file/URL) dan nama penyetuju retest.
- Riwayat append-only: tidak ada edit/hapus sesi (BR-7).

### F6 — Ekspor
- **CSV** `/api/v1/export/csv` dan **PDF** `/api/v1/export/pdf` mengikuti filter yang sama, maks 5.000 baris (BR-17). Kolom: Tanggal, Tester, Peran, Siklus, Fitur, Hasil, Severity, Lingkungan, Ulang, Catatan.
- CSV: BOM UTF-8, sel yang diawali `= + - @ \t \r` diberi prefiks `'` (anti formula injection).
- PDF dibuat **di server** (jsPDF + autotable, landscape, header hitam `[9,9,11]`, `maxDuration` 60 detik, ringkasan "N dari TOTAL baris"). Tombol "Unduh PDF" memanggil route tersebut.

### F7 — Master Data (ketua, kecuali dibaca semua)
- **Proyek** (`/proyek`): CRUD; `features.project_name → projects(name)` ON UPDATE CASCADE, ON DELETE RESTRICT; hapus diblokir bila dipakai fitur; jumlah fitur & sesi ditampilkan.
- **Fitur** (`/fitur`): nama unik case-insensitive; proyek wajib terdaftar & aktif; hapus ditolak bila punya riwayat (nonaktifkan sebagai gantinya); ketua dapat mengaktifkan/menonaktifkan, mengedit, memverifikasi. **Usulan tester disimpan `is_active=false, verified=false`** dan baru bisa dipakai setelah ketua memverifikasi (`PATCH /features/[id]/verify` → aktif + terverifikasi) (BR-24).
- **Peran uji** (`/peran`): `name` huruf kecil/angka/garis bawah (maks 50), `label`; seed `super_admin`, `admin_instansi`, `tester`.
- **Siklus** (`/siklus`): nama (maks 100), deskripsi, `brief` (maks 2000), aktif, **lingkup fitur** via `cycle_features` (kosong = semua fitur aktif). Non-ketua hanya melihat siklus aktif.
- **Pengguna** (`/pengguna`): buat (password ≥8), ubah role (tidak bisa menurunkan diri sendiri), hapus (ditolak untuk diri sendiri dan pengguna yang punya riwayat), tombol **Reset** untuk membuat tautan reset. API `PATCH` juga menerima nama/email/password (password baru mencabut semua sesi pengguna itu) walau UI tidak menyediakan tombolnya.
- Perubahan master tercatat di audit (F10).

### F8 — Akun & Pemulihan
- `/lupa-password`: respons selalu generik. Per pengguna maks **3 token per 15 menit** (BR-22). Di dev tanpa SMTP, tautan ditampilkan di respons (`devResetUrl`) — tidak pernah di produksi.
- `/reset-password?token=…`: password baru ≥8, token single-use 24 jam, hash SHA-256, token lama pengguna dihanguskan saat token baru dibuat, mencabut semua sesi (BR-11/12).
- Ketua membuat tautan reset (`POST /users/[id]/reset-link`) untuk pengguna mana pun — dicatat di audit. Tautan memakai `APP_URL` bila ada, kalau tidak origin request.

### F9 — Import Excel/CSV (`/impor`, ketua)
- Template CSV & XLSX; unggah `.xlsx`/`.csv` maks **2MB** dan **5.000 baris** (`.xls` tidak didukung). Parser `exceljs`; CSV dipisah koma.
- Pilih sheet dan baris header; mapping kolom otomatis (alias Indonesia/Inggris) + manual; preset mapping di perangkat (`sitester:import-mapping`).
- Kolom: Tanggal, Email Tester, Fitur, Hasil, Peran, Siklus, Test Case, Severity, Lingkungan, Diharapkan, Terjadi, Catatan, Bukti URL, Ulang. Tanggal `YYYY-MM-DD` atau `DD/MM/YYYY`; hasil `pass|lulus|ok`, `fail|gagal`, `bug|defect`.
- Pratinjau maks 500 baris (valid/error per baris, header error). **Unduh error CSV** untuk baris invalid.
- Commit: default all-or-nothing, opsi "lewati baris error"; transaksi + batch insert 100 baris; **dedupe hash baris** (`import_row_hash` unik; baris yang sudah ada dilewati dan dihitung `skipped`); `import_batches` (status `processing → committed | failed`) + audit `import.test_sessions`.
- Fail/Bug membuat defect (`created_by` = tester pada baris, `created_at` = tanggal uji). Import **tidak** menjalankan aturan retest, tidak mengirim notifikasi, tidak menghitung approval.
- Validasi: tester (email) ada, fitur/peran/siklus aktif, lingkup siklus, test case milik fitur, tanggal valid dan tidak di masa depan, severity valid, Fail/Bug butuh severity + catatan ≥10, URL bukti http(s) ≤2000. Error DB tidak dibocorkan (pesan generik + `console.error`); file rusak → 422.
- Riwayat batch ditampilkan di halaman.

### F10 — Test Case, Defect, Detail Fitur, Audit
- **Test case** (`test_cases`): judul (maks 255), langkah, expected, aktif. **Semua pengguna login bisa menambah** test case ke fitur mana pun; **ubah/hapus hanya pembuat atau ketua**. Non-ketua hanya melihat test case aktif lewat API. Dipilih opsional di form; harus milik fitur dan aktif (BR-14).
- **Defect** (`/defect`, semua peran melihat semua defect): Fail/Bug otomatis membuat tepat satu defect `open` (judul `Temuan: <fitur>`) per sesi (BR-15). Filter status dan fitur. Transisi: `open→fixed`, `reopened→fixed`, `fixed→verified|reopened`, `verified→closed|reopened`, `closed→reopened`; `verified` hanya ketua (BR-16). **Ubah status hanya oleh pembuat defect atau ketua** (BR-25); setiap perubahan diaudit (`defects.update`). Kolom `assignee`, `fix_reference`, `note`, `verified_by/at` didukung API; UI saat ini hanya mengubah status.
- **Detail fitur** (`/fitur/[id]`): ringkasan (total uji, Pass, Fail/Bug, defect terbuka), manajer test case, 50 defect terakhir, timeline 100 sesi (tanggal, hasil, severity, retest, tester, peran, siklus, test case, catatan, bukti). Timeline membuka sesi semua tester.
- **Aktivitas** (`/aktivitas`, ketua): audit `audit_logs` dengan pencarian dan filter aksi. Aksi yang dicatat: `features.{create,update,verify,delete}`, `projects.{create,update,delete}`, `testing_roles.{create,update,delete}`, `test_cycles.{create,update,delete}`, `users.{create,update,delete,reset_link}`, `test_cases.{create,update,delete}`, `defects.update`, `import.test_sessions`. **Login, keputusan approval, dan pembuatan sesi tidak masuk audit.** Password tidak pernah dicatat.

### F11 — Keamanan Upload (bukti)
- Hanya gambar PNG/JPEG/WebP/GIF, divalidasi **magic bytes**; ekstensi ditentukan server; maks 2MB (form dan AI run).
- Dengan `BLOB_READ_WRITE_TOKEN`: simpan ke Vercel Blob `access: "private"` (kolom `evidence_path` = pathname) dan sajikan lewat proxy ber-auth `/api/uploads/...`. Bila store tidak mendukung privat dan `BLOB_REQUIRE_PRIVATE` ≠ `1`, fallback publik bernama UUID (`evidence_path` = URL penuh); dengan `BLOB_REQUIRE_PRIVATE=1` upload ditolak.
- Tanpa token: dev menyimpan di `uploads/`; **produksi menolak** unggahan (tidak jatuh ke disk ephemeral).
- Route penyaji: wajib login, nama path divalidasi `[A-Za-z0-9._-]` (anti path traversal), `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: private, no-store`.
- Bukti AI run best-effort: kegagalan simpan tidak menggagalkan hasil (catatan sistem ditambahkan).

### F12 — Rate Limit & Sesi
- Login: 10 gagal/15 menit per email dan 30 gagal/15 menit per IP → 429 + `Retry-After`; login sukses menghapus hitungan email.
- IP: `x-real-ip`, lalu entri **terakhir** `x-forwarded-for` (helper `clientIp` dipakai bersama).
- Login baru mencabut sesi lama; reset password dan ganti password via API mencabut semua sesi pengguna.

### F13 — AI Test (`/ai-test`)
- Input: URL target (http/https, ≤2000), tujuan 5–2000 karakter, kriteria berhasil, fitur (aktif), peran, siklus (aktif; lingkup ditegakkan), opsi **login target per-run**: URL login, email/password, instruksi login, label field email/password/tombol (bawaan `Email` / `Kata sandi` / `Masuk`).
- Kuota **3 run aktif** (`queued`/`running`) per pengguna, ditegakkan atomik (`pg_advisory_xact_lock`).
- Status yang dipakai kode: `queued → running → completed | error`, lalu `confirmed` setelah dikonfirmasi (`failed` dan `cancelled` ada di CHECK tetapi belum dipakai). Pembuat run dan ketua dapat membuka run; tester lain tidak melihatnya.
- Runner mengambil antrean lewat `GET /api/v1/ai-runs/next` (Bearer token; klaim atomik `FOR UPDATE SKIP LOCKED`; run `running` yang `claimed_at` lebih dari 15 menit dikembalikan ke `queued`). Heartbeat `POST /ai-runs/[id]/heartbeat` tiap 5 menit memperbarui `claimed_at`. Hasil dikirim ke `POST /ai-runs/[id]/result` (outcome `pass|fail|bug|error`, catatan, log, severity, screenshot).
- Saat run dibuat server memicu `repository_dispatch` GitHub (`ai-run`) bila `GITHUB_DISPATCH_TOKEN` ada (repo default `andYeap/SiTester`, timeout 5 detik); tanpa token, jadwal tiap 5 menit/manual di `.github/workflows/ai-runner.yml` menjadi fallback. Endpoint `GET /ai-runs/ping` (204) dipakai preflight workflow.
- Runner (`scripts/ai-runner.mjs`) membuat konfigurasi + tes sementara di `.ai-runner/run-<id>/`, menjalankan **e2e by TesterArmy** (Chromium + model gratis via OpenRouter atau Google Gemini), mencoba model berikutnya di `E2E_MODELS` **hanya** bila error provider (`MODEL_PROVIDER_FAILED`, timeout, rate limit, dsb.).
- Klasifikasi hasil: lulus → `pass`; report hilang atau error provider → `error` (bukan `fail`); sisanya `fail`. Run `error` tidak bisa dikonfirmasi (hanya `completed` yang bisa).
- Hasil adalah **draft**: tombol Konfirmasi → form F1 → aturan retest/approval berlaku seperti biasa. Fitur/peran/siklus sesi harus sama dengan run; konfirmasi atomik (`status='completed' AND confirmed_session_id IS NULL`).
- Log run (`runner_log`, maks 100.000 karakter; nilai kredensial disamarkan `[redacted]`) dibuka lewat tombol **Log** (dinonaktifkan untuk run lama tanpa log).
- Kredensial per-run terenkripsi **AES-256-GCM** (`AI_CREDENTIALS_KEY` ≥20 karakter, **wajib di produksi**; di dev fallback ke `AI_RUNNER_TOKEN`), hanya didekripsi saat run diklaim, dihapus (`NULL`) saat hasil dikirim. Bila ketiga label login tidak lengkap, agent AI login sendiri dan **password ikut terkirim ke provider model** (UI menampilkan peringatan). Fallback `AI_TARGET_EMAIL/PASSWORD` dipakai bila run meminta login tanpa kredensial per-run.
- **Isolasi egress** (`scripts/ai-target-guard.mjs`): endpoint metadata cloud selalu diblokir; host yang mengarah ke IP privat/loopback/link-local/reserved ditolak kecuali runner menyetel `AI_RUNNER_ALLOW_PRIVATE_TARGETS=1`; host tak ter-resolve ditolak. Pemeriksaan yang sama diulang untuk setiap request browser (termasuk redirect dan navigasi agen) lewat route catch-all, bukan hanya URL target awal. Run terblokir berstatus `error` tanpa biaya model.
- Token runner: `AI_RUNNER_TOKEN` dan/atau daftar `AI_RUNNER_TOKENS` (koma; ID runner dari header `X-Runner-Id`).
- Waspadai prompt injection dari halaman target; gunakan akun tester berhak minimal.

---

## 4. Aturan Bisnis

| # | Aturan |
|---|---|
| BR-1 | Scope retest = (fitur, peran, siklus). Pencocokan siklus memakai `IS NOT DISTINCT FROM`: "tanpa siklus" hanya cocok dengan baris tanpa siklus |
| BR-2 | Hasil terakhir Pass dalam scope memblokir pengujian biasa; pengguna harus memilih "Pengujian Ulang" |
| BR-3 | Retest setelah Pass wajib punya approval ketua yang masih berlaku |
| BR-4 | Approval single-use, scope (fitur, peminta, peran, siklus), kedaluwarsa 7 hari sejak disetujui; approval siklus A tidak berlaku di siklus B |
| BR-5 | Hasil terakhir Fail/Bug: uji ulang boleh tanpa approval (dengan peringatan) |
| BR-6 | Satu permohonan pending per (fitur, peran, siklus); hanya untuk fitur yang hasil terakhirnya Pass dan belum punya approval berlaku; pending kedaluwarsa 7 hari; penolakan wajib beralasan |
| BR-7 | Riwayat `test_sessions` append-only (tanpa edit/hapus) |
| BR-8 | Fail/Bug wajib catatan ≥10 karakter + severity; fitur/peran/siklus harus aktif; siklus ber-lingkup menolak fitur di luar lingkup |
| BR-9 | Tester hanya melihat riwayat miliknya; `user_id` dari tester diabaikan. Agregat tim yang terlihat tester: "Fitur Belum Diuji", 10 fitur teratas, defect terbuka, daftar defect, detail fitur |
| BR-10 | Satu akun satu sesi aktif (login baru mencabut sesi lama) |
| BR-11 | Token reset password single-use, 24 jam, hanya hash yang disimpan |
| BR-12 | Reset/ganti password mencabut semua sesi pengguna |
| BR-13 | Import maks 5.000 baris / 2MB, transaksional; dedupe hash baris |
| BR-14 | Test case harus milik fitur yang diuji dan aktif |
| BR-15 | Fail/Bug membuat tepat satu defect `open` per sesi |
| BR-16 | Transisi defect sesuai F10; `verified` hanya ketua |
| BR-17 | PDF dan CSV memakai filter yang sama (maks 5.000 baris) |
| BR-18 | Bukti divalidasi magic bytes; produksi tanpa Blob = tolak |
| BR-19 | Rate limit login: 10/15 menit per email, 30/15 menit per IP |
| BR-20 | Kredensial login target per-run terenkripsi, tidak dikirim ke model bila login deterministik (tiga label lengkap), dihapus saat hasil dikirim |
| BR-21 | Log runner per AI run (maks 100.000 karakter), dapat dibaca pembuat run/ketua, tanpa kredensial |
| BR-22 | Reset password maks 3 token per pengguna per 15 menit; respons selalu generik |
| BR-23 | `Idempotency-Key` unik per pengguna `(user_id, idempotency_key)`; replay mengembalikan sesi yang sama tanpa efek ganda |
| BR-24 | Usulan fitur dari non-ketua `is_active=false, verified=false` sampai diverifikasi ketua |
| BR-25 | Update status defect hanya oleh pembuat defect atau ketua |

---

## 5. Model Data

Migrasi berversi di `db/migrations/0001…0012_*.sql` dicatat di `schema_migrations`; `scripts/migrate.mjs` menjalankannya berurutan, tiap file dalam satu transaksi. `db/schema.sql` = snapshot fresh-install/test (**harus disinkronkan manual** tiap ada migrasi baru; `tests/api/global-setup.ts` memakainya untuk DB uji).

| Kelompok | Tabel |
|---|---|
| Akun | `users` (role `tester`/`ketua_tim`), `sessions`, `login_attempts`, `password_reset_tokens` |
| Master | `projects`, `testing_roles`, `test_cycles` (+`brief`), `cycle_features`, `features` (+`verified`), `test_cases` |
| Pengujian | `test_sessions` (+`test_case_id`, `import_batch_id`, `import_row_hash`, `idempotency_key`, `retest_approval_id`), `retest_requests`, `retest_approvals` (keduanya + `test_cycle`, `expires_at`), `defects` |
| Lainnya | `notifications`, `audit_logs`, `import_batches`, `ai_test_runs` (+kolom login, `login_credentials_enc`, `runner_log`) |

| Migrasi | Isi |
|---|---|
| `0001` | Baseline (skema v2 + seed peran/siklus) |
| `0002` | `password_reset_tokens` |
| `0003` | FK proyek, `test_cases`, `defects` (+backfill), `retest_approvals.note` |
| `0004` | Indeks performa |
| `0005` | `import_batches`, hash baris import |
| `0006`–`0008`, `0010` | `ai_test_runs` + kolom login, `runner_log`, status `error` |
| `0009` | `test_cycle` pada permohonan/approval retest |
| `0011`–`0012` | Idempotensi sesi → unik per pengguna |

Seed demo (`npm run db:seed`, idempoten): 1 ketua `ketua@testlab.test` + `tester1..3@testlab.test` (password `password`), proyek "Proyek Utama", 10 fitur contoh. Siklus `Lensa-ASN R1/R2` dan 3 peran uji datang dari migrasi baseline.

---

## 6. Non-Fungsional & Operasi

- Guard server di setiap route (`needUser`/`needKetua`, redirect di page); pesan validasi Bahasa Indonesia; error DB tidak dikirim mentah ke klien (`UserError` untuk pesan aman, selain itu 500 generik + `console.error`).
- Zona waktu tunggal Asia/Jakarta (`lib/time.ts`); `tested_at` bertipe `date`.
- Header keamanan (`next.config.ts`): `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS 2 tahun. `cacheComponents` dimatikan (semua halaman dinamis).
- `src/proxy.ts`: `/` → `/dashboard`; semua route aplikasi (termasuk `/proyek`) tanpa cookie sesi → `/login?next=…`.
- **CI** (`.github/workflows/ci.yml`): job `quality` (Node 22: lint, `tsc`, `npm test` dengan service Postgres 16, build), job `e2e` (Playwright, DB `testlab_e2e`), job `e2e-agentic` (Node 24, TesterArmy; test agentic di-skip tanpa env). Workflow `ai-runner.yml` (Node 24) menjalankan antrean AI Test.
- **Health:** `GET /api/health` (200 `{status:"ok",db:"up"}` / 503). `instrumentation.ts` mencatat error request sebagai JSON terstruktur.
- **Cleanup:** `npm run db:cleanup` menghapus sesi kedaluwarsa, token reset terpakai/kedaluwarsa, permohonan pending kedaluwarsa, approval kedaluwarsa belum terpakai, `login_attempts` >30 hari, notifikasi terbaca >90 hari.
- **Backup:** `scripts/backup.sh` (pg_dump format custom via Docker `postgres:18-alpine`, mengikuti versi server Neon); restore dengan `pg_restore` (lihat README).
- Performa: query dashboard paralel, sesi + jumlah notifikasi dalam satu query ber-`cache`, `loading.tsx`, `PG_POOL_MAX` kecil di serverless, grafik di-import dinamis.
- Dependensi utama: Next 16.4.3, React 19.3.0, `pg` 8, recharts 3, jspdf 4 + autotable 5, exceljs 4, nodemailer, `@vercel/blob`; uji: vitest 5, Playwright, e2e (TesterArmy), `ai` SDK.

---

## 7. Desain (monokrom)

Latar terang, tinta hitam (bukan dark mode). Status dibedakan oleh **label teks + bentuk border**, bukan warna.

- **Token:** tinta `#09090b` (aksi primer, judul, sidebar), kertas `#fafafa` + kartu `#ffffff`, satu skala `neutral-*`. Tidak ada aksen warna, gradien, atau emoji sebagai ikon.
- **Status:** `badge-pass` (hitam solid) · `badge-fail` (border-2) · `badge-bug` (border putus-putus) · `badge-neutral`/`badge-outline`. Grafik: bar `#09090b`; donut `#09090b/#71717a/#d4d4d8` + legenda.
- **Kelas bersama** (`src/app/globals.css`): `.card/.card-pad`, `.page-title/.page-subtitle`, `.btn-primary/.btn-dark/.btn-success-solid` (aksi utama), `.btn-soft` (sekunder), `.btn-danger-soft` (hanya Tolak), `.icon-btn`, `.action-link`, `.label/.hint`, `.input/.input-file`, `.table-head/.table-th` + `caption.sr-only`, `.badge` varian, `.alert-ok/err/warn/info`, `.empty-state` (+CTA), `.skeleton` (hormati `prefers-reduced-motion`), `.timeline`.
- **Aksesibilitas:** tombol `min-h-11` (44px), `focus-visible` ring hitam, label terasosiasi (`htmlFor`/`id`), radio dalam `fieldset/legend`, `aria-live` untuk area muat, `lang="id"`, notifikasi belum dibaca = `bg-neutral-100` + titik + badge "Baru".
- **Pola halaman:** judul → subjudul; filter dalam `.card` + "Atur ulang"; tabel `overflow-x-auto`; form `card-pad` dengan pesan ber-`role`; baris pratinjau import invalid `bg-neutral-100` + daftar error.
- **Navigasi:** sidebar kiri gelap (aktif = pil putih; `aria-current="page"`); topbar putih hanya tombol menu (mobile) + bel. Grup "Utama": Dashboard, Pengujian Baru, Riwayat, Fitur, Defect, AI Test, Notifikasi. Grup "Manajemen" (ketua): Proyek, Permohonan, Pengguna, Peran Uji, Siklus, Import, Aktivitas.
- **Bahasa:** Indonesia untuk non-teknis ("Kata sandi", "Unduh CSV/PDF", "Atur ulang"); istilah domain Pass/Fail/Bug dipertahankan.

---

## 8. Status Implementasi

| Gelombang | Isi | Status |
|---|---|---|
| v2 | Fondasi DB+seed, auth+shell, aturan retest murni, master data, form+retest+notifikasi, riwayat+dashboard, ekspor+bukti, test API, rate limit, approval kedaluwarsa, audit, paginasi, hardening (zona waktu, header, backup, sesi tunggal), lingkup siklus, master proyek, "Ingat saya" | Selesai |
| v3 | Migrasi berversi, reset password, import, notifikasi eksternal + upload aman, Tugas Saya, test case + detail fitur, defect lifecycle, form v3, riwayat v3, CI + E2E | Selesai |
| Audit 4 Nov 2026 | Update defect hanya pembuat/ketua; "tanpa siklus" tepat sama; retest membawa siklus (`0009`); idempotensi per pengguna (`0012`); bukti privat; error DB generik; draft per pengguna; validasi AI run vs sesi; `can-test` menegakkan lingkup; dashboard menampilkan permohonan kedaluwarsa; rate limit forgot-password; advisory lock anti dua Pass; `.env.example`; hapus route mati; transaksi reject retest; PDF server-side; transisi defect diketatkan; batas import 2MB/5.000 baris | Selesai |
| AI Test hardening | Peringatan password ke model; report hilang = `error`; redaksi kredensial di log; kunci kredensial wajib di produksi; heartbeat + reclaim 15 menit; token per-runner; kuota anti-balapan; isolasi egress; Blob privat ketat; E2E defect+import; smoke beban | Selesai |

**Keputusan arsitektur yang perlu diingat**
- Retest/approval memakai scope siklus *tepat sama*; tidak ada wildcard lintas siklus.
- `tested_at` bertipe `date`, jadi tidak ada klaim "24 jam" — peringatan memakai "sejak kemarin".
- Import sengaja append-only dan tidak menjalankan aturan retest.
- Browser AI Test berjalan di runner, bukan di Vercel; target internal hanya bila runner mengizinkan.
- Jangan membuat `.env` di root; gunakan `.env.local` (dev) dan `.env.neon` (dibaca eksplisit per perintah) — lihat README.

**Utang teknis & celah yang diketahui**
- `TRANSITIONS` defect diduplikasi di client (`DefectView`) dan server.
- PDF belum memetakan guard formula-injection (CSV sudah).
- `clearDraftFor` belum dipanggil saat logout (draft per-pengguna mencegah kebocoran antar akun).
- `successUrlContains` runner dipakai sebagai regex mentah.
- Audit belum mencakup login, keputusan approval, dan pembuatan sesi.
- UI defect belum bisa mengisi `assignee`/`fix_reference`/`note` (API sudah mendukung); UI pengguna belum punya form ganti password langsung.
- `failed`/`cancelled` pada status AI run belum dipakai.


---

## 9. Di Luar Cakupan / Backlog

SSO/OAuth, multi-tenant, komentar realtime, multi-lampiran, integrasi Jira/Linear, aplikasi native, import `.xls` lama, import >5.000 baris lewat unggah langsung ke Blob, notifikasi perubahan status defect, tombol edit assignee/referensi fix di UI.

---

## 10. Verifikasi

Definition of done tiap perubahan:

```bash
npm run lint
npx tsc --noEmit
npm test            # unit + API, butuh Postgres (TEST_DATABASE_URL)
npm run build
npm run test:e2e    # Playwright: 7 skenario (login ×3, defect, import, regresi UI M4/M5 dan M8)
```

Hasil pada 4 November 2026 (setelah perbaikan inkonsistensi di atas HEAD `c9fabbb`): `npm run lint` bersih, `npx tsc --noEmit` bersih, `npm test` **113 test lulus di 36 file**, `npm run test:e2e` **7 skenario lulus**. `build` dan `load:smoke` tidak dijalankan ulang pada pemeriksaan ini.

Opsional: `npm run load:smoke` (100 req / 10 konkuren, gate p95 + 0 error; butuh dev server + `LOAD_EMAIL`/`LOAD_PASSWORD`). Manual rilis: lupa password → reset → login; import 2 valid + 1 error; Fail → defect open → fixed → verified; PDF = CSV pada filter yang sama; bukti non-gambar ditolak.
