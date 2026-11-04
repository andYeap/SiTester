# SITester — pencatatan & kendali pengujian tim tester

Next.js 16 + Postgres, siap Vercel. Spesifikasi, aturan bisnis, desain, dan status implementasi ada di **[`PRD.md`](PRD.md)**. Panduan untuk tester dan ketua tim: **[`PANDUAN-PENGGUNAAN.md`](PANDUAN-PENGGUNAAN.md)**. README ini fokus pada setup, konfigurasi, deploy, dan operasi.

## Fitur

- Form pengujian: draft otomatis, severity hanya saat Fail/Bug, mode cepat multi-hasil, submit idempoten.
- Retest per (fitur, peran, siklus) dengan approval ketua sekali pakai (7 hari).
- Tugas Saya di dashboard, test case per fitur, defect lifecycle (open → fixed → verified → closed), detail fitur + timeline.
- Riwayat dengan filter, sort, preset 7/30 hari, filter tersimpan, ekspor CSV dan PDF (PDF dibuat di server, mengikuti filter, maks 5.000 baris).
- Import Excel/CSV (maks 2MB / 5.000 baris) dengan pratinjau, mapping kolom, dedupe, dan riwayat batch.
- Akun: lupa/reset password (token 24 jam), tautan reset dari ketua, sesi 8 jam atau 30 hari ("Ingat saya").
- Notifikasi in-app + email (SMTP) dan Telegram opsional.
- AI Test: antrean pengujian otomatis yang dijalankan runner eksternal (e2e by TesterArmy), hasilnya draft untuk dikonfirmasi.
- Hardening: magic-bytes upload, rate limit email + IP, health check, audit aktivitas, CI, E2E.

## Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16.4 (App Router) + React 19 + Tailwind v4 |
| Bahasa | TypeScript |
| DB | PostgreSQL (`pg` + SQL langsung, tanpa ORM); migrasi berversi di `db/migrations` |
| Auth | Sesi opak di cookie httpOnly, hash scrypt |
| Grafik / PDF / Excel | recharts, jspdf + autotable (server), exceljs |
| Email | nodemailer (SMTP) |
| Bukti upload | Vercel Blob privat + proxy ber-auth (produksi) / folder `uploads/` (dev) |
| Uji | vitest (unit + API), Playwright (E2E), e2e by TesterArmy (agentic/AI Test) |
| Deploy | Vercel (Node runtime) + Neon Postgres |

Next.js versi ini punya breaking change dari yang umum dikenal; baca `node_modules/next/dist/docs/` sebelum mengubah kode (lihat `AGENTS.md`).

## Menjalankan lokal

Butuh Node 22+ dan Postgres.

```bash
# 1. Postgres lokal (contoh: container yang sudah ada)
docker start lensa-pg
docker exec lensa-pg psql -U lensa -d lensa -c "CREATE DATABASE testlab;"

# 2. Konfigurasi
cp .env.example .env.local   # sesuaikan DATABASE_URL

# 3. Dependensi, migrasi, seed
npm install
npm run db:migrate
npm run db:seed    # opsional

# 4. Jalankan
npm run dev
```

Buka `http://localhost:3000`. Seed membuat `ketua@testlab.test` dan `tester1@testlab.test`…`tester3@testlab.test` (password `password`), proyek "Proyek Utama", dan 10 fitur contoh. Peran uji (`super_admin`, `admin_instansi`, `tester`) dan siklus `Lensa-ASN R1/R2` dibuat oleh migrasi awal.

> **Penting soal `.env`**: JANGAN membuat file bernama `.env` di folder ini. Node `--env-file` dan Next.js menggabungkan `.env` + `.env.local` dengan aturan prioritas berbeda, sehingga migrate bisa berjalan ke database production sementara web server ke lokal (atau sebaliknya). Kredensial Neon disimpan di `.env.neon` (tidak pernah dibaca otomatis) dan dipakai eksplisit per perintah:
> `DATABASE_URL="$(grep ^DATABASE_URL .env.neon | cut -d= -f2-)" npm run db:migrate`

## Variabel lingkungan

| Variabel | Dipakai di | Keterangan |
|---|---|---|
| `DATABASE_URL` | app, skrip DB | Wajib. Di Vercel pakai URL **pooled**; migrasi/seed pakai URL direct |
| `PG_POOL_MAX` | app | Default 5; di serverless set kecil (`3`) |
| `APP_URL` | app | Basis URL untuk tautan di email/Telegram/reset (tanpa ini dipakai origin request) |
| `BLOB_READ_WRITE_TOKEN` | app | **Wajib di produksi** untuk bukti; tanpa ini unggahan ditolak |
| `BLOB_REQUIRE_PRIVATE` | app | `1` = tolak fallback Blob publik (butuh Blob store privat) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | app | Email opsional (aktif bila `SMTP_HOST` + `SMTP_FROM` ada; port default 587) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | app | Notifikasi Telegram untuk ketua, opsional |
| `AI_RUNNER_TOKEN` | app + runner | Token Bearer endpoint runner (≥20 karakter) |
| `AI_RUNNER_TOKENS` | app | Token tambahan per host runner, dipisah koma |
| `AI_CREDENTIALS_KEY` | app | **Wajib di produksi** (≥20 karakter): kunci enkripsi kredensial login target |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO` | app | Memicu workflow runner saat run dibuat (repo default `andYeap/SiTester`) |
| `SITESTER_URL` | runner, `load:smoke` | URL aplikasi (default `http://localhost:3000`) |
| `E2E_PROVIDER`, `E2E_MODEL`, `E2E_MODELS` | runner, e2e | Provider model (`openrouter`/`google`) dan model; `E2E_MODELS` = daftar fallback |
| `OPENROUTER_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | runner, e2e | Kunci provider model |
| `AI_TARGET_EMAIL`, `AI_TARGET_PASSWORD` | runner | Fallback kredensial login target |
| `AI_RUNNER_ID` | runner | Penanda runner di log/heartbeat |
| `AI_RUNNER_ALLOW_PRIVATE_TARGETS` | runner | `1` = izinkan target IP privat/localhost |
| `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_APP_URL` | e2e agentic | Akun dan URL untuk tes agentic |
| `TEST_DATABASE_URL`, `E2E_DATABASE_URL` | test | DB terpisah untuk vitest (`testlab_test`) dan Playwright (`testlab_e2e`) |
| `LOAD_EMAIL`, `LOAD_PASSWORD`, `CONCURRENCY`, `REQUESTS`, `P95_BUDGET_MS` | `load:smoke` | Parameter smoke beban |

## Skrip

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build + production server |
| `npm run preview` | Build produksi lalu start (untuk menilai performa) |
| `npm test` | Unit + API (butuh Postgres; default DB `testlab_test` di `127.0.0.1:55432`, override via `TEST_DATABASE_URL`) |
| `npm run test:api` | Hanya test API |
| `npm run test:e2e` | Playwright (login, proteksi route, defect, import, regresi UI); DB terisolasi `testlab_e2e`, jalan serial |
| `npm run load:smoke` | 100 req dashboard / 10 konkuren, gate p95 + 0 error (butuh dev server + akun) |
| `npm run db:migrate` | Terapkan `db/migrations/*.sql` (dicatat di `schema_migrations`) |
| `npm run db:seed` | Data demo (idempoten) |
| `npm run db:cleanup` | Hapus sesi/token/permohonan/approval kedaluwarsa, `login_attempts` >30 hari, notifikasi terbaca >90 hari |
| `npm run e2e:list`, `e2e:check-model`, `test:e2e:ai` | e2e by TesterArmy (lihat bagian AI) |
| `npm run ai-runner`, `ai-runner:once` | Runner AI Test (loop / sekali jalan) |
| `npm run lint` | ESLint |
| `DATABASE_URL=... ./scripts/backup.sh` | Backup DB via Docker ke `backups/` |

Setiap menambah migrasi baru di `db/migrations`, sinkronkan juga `db/schema.sql` (dipakai DB uji dan fresh install).

## AI Test (runner) dan e2e by TesterArmy

Pengguna mengantrekan pengujian di `/ai-test`; **runner eksternal** menjalankan [e2e by TesterArmy](https://e2e.tester.army) (Chromium + agent AI) terhadap URL target lalu mengirim hasil + screenshot. Hasil menjadi **draft** yang harus dikonfirmasi lewat form pengujian (aturan retest tetap berlaku). Vercel hanya menyimpan antrean dan hasil karena tidak cocok menjalankan Chromium penuh.

Alur: `/ai-test` → antre → runner → hasil + bukti → **Konfirmasi** → `/pengujian-baru?ai_run=…` → simpan.

### Provider dan model

Provider dipilih lewat `E2E_PROVIDER`; bila tidak diisi, kode memakai `openrouter`. Cek nilai yang aktif di `.env.local` (lokal/runner) dan GitHub → Settings → Secrets and variables → Actions → Variables.

| Provider | Kunci | Model bawaan di kode | Catatan |
|---|---|---|---|
| `openrouter` (default kode) | `OPENROUTER_API_KEY` | `nvidia/nemotron-3.5-super-vl:free` (fallback gratis: `google/gemma-4-31b-it:free`) | Model gratis punya limit harian/menit dan datanya bisa dipakai untuk pelatihan |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-3.6-flash` (runner dan `e2e.config.ts`) | Kuota gratis terpisah dari OpenRouter; runner otomatis menambahkan fallback `gemini-3.6-flash` lalu `gemini-2.5-flash` |

- `E2E_MODEL` mengganti model; `E2E_MODELS` (dipisah koma) memberi urutan fallback. Fallback hanya berjalan saat **error provider** (high demand, timeout, rate limit), bukan saat verdict `fail`.
- `npm run e2e:check-model` memverifikasi model (OpenRouter: masih $0, vision, tools, endpoint online; Google: tersedia dan mendukung `generateContent`). Default model Google di skrip ini sama dengan runner (`gemini-3.6-flash`).
- Jangan memakai data sensitif pada model gratis.

### Login ke target

- Centang **Perlu login ke target** lalu isi URL login (opsional), email/password target, instruksi login, dan label field (`Email`, `Kata sandi`, `Masuk`).
- **Ketiga label lengkap** → login deterministik (`getByLabel`/`getByRole`), kredensial tidak masuk ke model. **Label tidak lengkap** → agent AI login sendiri dan **password ikut dikirim ke provider model**.
- Kredensial disimpan terenkripsi AES-256-GCM (`login_credentials_enc`), hanya didekripsi saat run diklaim, dan dihapus saat hasil dikirim. Kunci: `AI_CREDENTIALS_KEY` (wajib di produksi; fallback ke `AI_RUNNER_TOKEN` hanya di dev). Merotasi token runner tanpa kunci khusus membuat kredensial lama tak terbaca.
- Run yang meminta login tanpa kredensial per-run memakai `AI_TARGET_EMAIL`/`AI_TARGET_PASSWORD` pada runner.

### Menjalankan runner

```env
# Vercel (+ .env.local untuk lokal): antrean dan enkripsi
AI_RUNNER_TOKEN=<acak ≥20 karakter>
AI_CREDENTIALS_KEY=<acak ≥20 karakter>
GITHUB_DISPATCH_TOKEN=<fine-grained PAT, Contents: Read and write>   # opsional
GITHUB_REPO=andYeap/SiTester                                          # opsional

# Runner (.env.local runner / GitHub Secrets & Variables; jangan di Vercel)
SITESTER_URL=https://<domain-aplikasi>
AI_RUNNER_TOKEN=<sama dengan di Vercel>
E2E_PROVIDER=google            # atau openrouter
GOOGLE_GENERATIVE_AI_API_KEY=...   # jika google
OPENROUTER_API_KEY=...             # jika openrouter
E2E_MODEL=gemini-3.6-flash
AI_RUNNER_ALLOW_PRIVATE_TARGETS=   # 1 hanya untuk target internal
```

- **24 jam**: `npm run ai-runner` di VPS/laptop yang selalu hidup (mis. systemd di Oracle Cloud Always Free).
- **Tanpa VPS**: workflow `.github/workflows/ai-runner.yml` (Node 24) berjalan tiap 5 menit (jadwal GitHub bisa tertunda) dan dapat dijalankan manual. Dengan `GITHUB_DISPATCH_TOKEN`, setiap `POST /api/v1/ai-runs` memicu `repository_dispatch` (`ai-run`) sehingga runner mulai tanpa menunggu cron; cold start ±30–90 detik.
- Workflow melakukan preflight ke `GET /api/v1/ai-runs/ping`; token yang belum diset/tidak cocok membuat runner dilewati dengan peringatan. Set `AI_RUNNER_TOKEN` + `AI_CREDENTIALS_KEY` di Vercel (semua environment) lalu redeploy.
- Variabel workflow: Secrets `AI_RUNNER_TOKEN`, `OPENROUTER_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_TARGET_EMAIL`, `AI_TARGET_PASSWORD`; Variables `SITESTER_URL`, `E2E_PROVIDER`, `E2E_MODEL`.
- Run yang `running` tanpa heartbeat >15 menit dikembalikan ke antrean; runner mengirim heartbeat tiap 5 menit.
- Token boleh berbeda per host lewat `AI_RUNNER_TOKENS`.
- **Isolasi egress**: runner menolak endpoint metadata cloud dan host yang mengarah ke IP privat/loopback sebelum memakai model; run yang diblokir dicatat `error` tanpa biaya model.
- **Audit**: tiap run menyimpan `runner_log` (stdout/stderr, error model, report e2e; maks 100.000 karakter, kredensial disamarkan `[redacted]`) yang dibuka lewat tombol **Log**. Log workflow lengkap tetap ada di GitHub Actions selama masa retensi.
- **Keamanan**: agent dapat dipengaruhi konten halaman target (prompt injection). Pakai akun tester berhak minimal dan jangan menguji situs tanpa izin.
- **Hemat kuota**: isi ketiga label login, tulis tujuan singkat dengan kriteria spesifik, jangan antrekan ulang run `fail` tanpa membaca Log.

### Tes e2e di repo

`e2e.config.ts` + `tests/e2e-agent/smoke.e2e.ts` (menyalakan dev server di port 3200 kecuali `E2E_APP_URL` diisi).

```bash
npm run e2e:list         # daftar tes
npm run e2e:check-model  # cek model
npm run test:e2e:ai      # jalankan
```

- Dua tes deterministik (halaman login, redirect `/dashboard`) tidak butuh model dan selalu jalan.
- Tes agentic (`agent: login dan dashboard tampil`) hanya jalan bila `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_MODEL`, dan kunci provider tersedia; selain itu di-skip. Password dikirim sebagai `credentials`, bukan ke input model.
- Cache replay dan report ada di `.e2e/` (di-ignore git; diunggah sebagai artifact CI). Telemetry dimatikan via `E2E_TELEMETRY_DISABLED=1`.
- CI menjalankan job `e2e-agentic`; isi secret/variable di GitHub bila ingin tes agentic aktif.

## Batas import

- Format `.xlsx` dan `.csv` (`.xls` tidak didukung); maks **2MB** dan **5.000 baris**. 2MB adalah batas aman agar commit selesai dalam `maxDuration` 60 detik Vercel (body request Vercel ±4.5MB).
- Untuk file lebih besar: pecah menjadi beberapa file.
- Import hanya untuk ketua; baris duplikat (hash sama) otomatis dilewati.

## Deploy ke Vercel (gratis, tanpa kartu kredit)

1. **Database**: buat Postgres gratis (Neon direkomendasikan). Simpan dua URL: pooled (`…-pooler…`) untuk `DATABASE_URL` runtime, dan direct untuk migrasi/seed.
2. **Environment variables** di Vercel: `DATABASE_URL` (pooled), `PG_POOL_MAX=3`, `APP_URL`, `BLOB_READ_WRITE_TOKEN` (wajib untuk bukti), `AI_RUNNER_TOKEN` + `AI_CREDENTIALS_KEY` (bila memakai AI Test), opsional SMTP/Telegram/`GITHUB_DISPATCH_TOKEN` (lihat tabel di atas).
3. **Migrasi & seed** dari mesin lokal ke direct URL:
   ```bash
   DATABASE_URL='postgres://…direct…' npm run db:migrate
   DATABASE_URL='postgres://…direct…' npm run db:seed   # opsional
   ```
4. **Deploy**: hubungkan repo ke Vercel (framework terdeteksi otomatis; tidak perlu `vercel.json`).

Catatan produksi:
- Cookie otomatis `Secure` karena `NODE_ENV=production`; sesi disimpan di DB sehingga logout benar-benar mencabut akses.
- Jangan set `PG_POOL_MAX` tinggi di serverless.
- Jadwalkan `npm run db:cleanup` berkala (cron) bila ingin tabel token/percobaan login tetap kecil.
- Pantau `GET /api/health` (200 `ok`, 503 bila DB mati).

### Performa di Vercel

Urut prioritas:
1. **Samakan region** Vercel Functions dan Postgres (mis. `sin1` + Neon Singapore); sering memangkas latency ratusan ms.
2. Aktifkan **Fluid Compute** agar instance dipakai ulang.
3. Pakai URL **pooled** Neon dan `PG_POOL_MAX=3`.
4. Neon free auto-suspend: hangatkan DB (ping berkala) selama jam pengujian atau pakai paket yang tidak suspend.
5. Pastikan migrasi indeks (`0004_v3_perf.sql`) sudah diterapkan.
6. **Jangan menilai kecepatan dari `npm run dev`** (kompilasi per route, prefetch mati); pakai `npm run preview` atau deployment.
7. Ukur dengan data nyata (Speed Insights/Analytics), bukan hanya localhost.
8. Bila masih lambat: cache daftar master dengan `unstable_cache` + `revalidateTag`, atau pertimbangkan driver serverless Neon.

Di kode: dashboard menjalankan query paralel, sesi + jumlah notifikasi diambil satu query ber-`cache`, grafik dimuat lazy, link internal memakai `next/link` + `loading.tsx`, dan `proxy.ts` hanya berjalan untuk route aplikasi.

## Backup mingguan (disarankan)

`scripts/backup.sh` memakai Docker `postgres:18-alpine` (mengikuti versi server Neon) dan URL direct. Jadwalkan cron di mesin yang punya Docker + akses DB:

```cron
0 2 * * 0 cd /path/ke/sitester && DATABASE_URL='postgres://…' ./scripts/backup.sh >> backups/backup.log 2>&1
```

Restore ke database kosong:

```bash
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -v "$PWD/backups:/b:ro" postgres:18-alpine \
  pg_restore --clean --if-exists -d "$DATABASE_URL" /b/<file-dump>
```

Untuk DB lokal, `localhost`/`127.0.0.1` di URL otomatis dialihkan ke `host.docker.internal` oleh skrip backup (pada perintah restore di atas, ganti manual bila perlu).
