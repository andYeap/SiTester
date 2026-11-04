# SITester — pencatatan & kendali pengujian tim tester (Next.js + Postgres, siap Vercel)

Rewrite dari aplikasi TestLab versi Laravel (`../testlab`). Paritas fitur penuh + deploy gratis.
Panduan pengguna: **`PANDUAN-PENGGUNAAN.md`**. Lihat `PRD.md` (spesifikasi v3), `PLAN-v3.md` (rencana), dan `DESIGN.md`.

## Fitur v3

- Form pengujian dengan **draft otomatis**, triase progresif (severity hanya saat Fail/Bug), dan **mode cepat** multi-hasil.
- Retest per (fitur, peran, siklus) + approval single-use 7 hari; notifikasi in-app + **email/Telegram opsional**.
- **Tugas Saya**: fitur belum diuji, permohonan retest, defect terbuka.
- **Test case** per fitur + **defect lifecycle** (open → fixed → verified → closed).
- **Detail fitur**: test case, defect, dan timeline sesi.
- Riwayat: sort, preset tanggal, filter tersimpan, kartu mobile.
- **Import Excel/CSV** dengan pratinjau, mapping kolom, pilih sheet/header, skip baris error, error CSV, dedupe, dan riwayat batch (maks 2MB / 5.000 baris).
- Ekspor CSV/PDF **mengikuti filter** (PDF seluruh hasil, bukan satu halaman).
- Akun: lupa password, reset password token 24 jam, tautan reset dari ketua.
- Hardening: upload magic-bytes, rate limit email+IP, health check, CI, E2E.
- **AI E2E opsional** dengan [e2e by TesterArmy](https://e2e.tester.army): test deterministik + agentic (`e2e.config.ts`, `tests/e2e-agent/`).

## Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + Tailwind v4 |
| Bahasa | TypeScript |
| DB | PostgreSQL 16 (`pg` + SQL langsung, tanpa ORM) |
| Auth | Sesi opak di cookie httpOnly, hash scrypt |
| Grafik | recharts (client) |
| Upload bukti | Vercel Blob (bila token ada) / disk lokal (dev) |
| Deploy | Vercel (Node runtime), gratis |

## Menjalankan lokal

```bash
# 1. Postgres lokal (pakai container lensa yang sudah ada)
docker start lensa-pg
docker exec lensa-pg psql -U lensa -d lensa -c "CREATE DATABASE testlab;"

# 2. Konfigurasi
cp .env.example .env.local   # sesuaikan DATABASE_URL

# 3. Migrasi + seed
npm install
npm run db:migrate
npm run db:seed    # opsional: 1 ketua + 3 tester (password: password), 10 fitur, 2 siklus

# 4. Jalankan
npm run dev
```

Buka `http://localhost:3000`, masuk dengan `ketua@testlab.test` /
`tester1@testlab.test` (password: `password`).

## Performa

- **Jangan menilai kecepatan dari `npm run dev`.** Dev mengompilasi route saat pertama dibuka dan prefetch dinonaktifkan. Untuk merasakan performa sebenarnya: `npm run preview` (build produksi + start).
- Dashboard menjalankan query secara paralel (bukan berurutan); sesi + jumlah notifikasi diambil dalam **satu query** dan dideduplikasi lewat React `cache`.
- Migrasi `0004_v3_perf.sql` menambah index `(user_id, tested_at)`, `(tested_at)`, `(is_active, name)`, dan index notifikasi unread. Jalankan `npm run db:migrate` setelah update.
- Semua link internal memakai `next/link` (client-side navigation) + `loading.tsx` sebagai skeleton instan.
- Saat deploy: letakkan app dan Postgres di **region yang sama** (mis. Vercel + Neon Singapore), pakai URL **pooled**, dan hindari cold start Neon saat sesi pengujian (Neon free auto-suspend).

## Performa di Vercel

Checklist yang paling berdampak (urut prioritas):

1. **Samakan region**: Vercel Functions dan Postgres harus satu region (contoh `sin1` Singapore untuk Neon Singapore). Set di Project Settings → Functions → Region. Ini sering mengubah latency 200–800 ms menjadi 10–40 ms.
2. **Aktifkan Fluid Compute** (Project Settings → Functions) agar instance dipakai ulang dan cold start berkurang.
3. **Pakai URL pooled Neon** (`...-pooler...`) dan `PG_POOL_MAX=3`. Jangan set tinggi di serverless.
4. **Neon cold start**: free tier auto-suspend. Untuk jam pengujian, hangatkan DB (ping berkala) atau gunakan paket yang tidak suspend.
5. **Jalankan migrasi index**: `npm run db:migrate` (migrasi `0004_v3_perf.sql`).
6. **Ukur dengan data nyata**: aktifkan Vercel Speed Insights / Analytics, lalu bandingkan TTFB halaman, bukan hanya localhost.
7. **Jangan pakai `npm run dev`** untuk pemakaian nyata; gunakan `npm run preview` atau deployment.
8. Jika masih lambat: cache daftar master (fitur/peran/siklus/proyek) dengan `unstable_cache` + `revalidateTag`, dan pertimbangkan `@neondatabase/serverless` untuk query satu-kali.

Catatan kode: middleware (`proxy.ts`) hanya berjalan di route aplikasi (bukan `/api`/aset/publik), dashboard memakai query paralel, auth+unread satu query, grafik dimuat lazy, dan semua link internal memakai `next/link` + `loading.tsx`.

## AI E2E (e2e by TesterArmy)

Selain Playwright (`npm run test:e2e`), project punya integrasi opsional
[e2e by TesterArmy](https://e2e.tester.army) di `e2e.config.ts` dan
`tests/e2e-agent/`. Runner ini otomatis menyalakan dev server di port 3200.

```bash
npm run e2e:list          # daftar test
npm run e2e:check-model   # cek model gratis masih $0, vision, tools, online
npm run test:e2e:ai       # jalankan (test deterministik tidak butuh model)
```

- **Model default (gratis): `nvidia/nemotron-3.5-super-vl:free`** via OpenRouter — $0, vision (screenshot/GUI), tool calling, context 1M. Fallback gratis: `google/gemma-4-31b-it:free`.
- **Jika kuota harian OpenRouter habis** (`free-models-per-day`), pindah ke **Google Gemini free tier** (kuota terpisah, tanpa kartu):
  ```env
  E2E_PROVIDER=google
  E2E_MODEL=gemini-3.8-flash
  GOOGLE_GENERATIVE_AI_API_KEY=...
  ```
  Buat key gratis di Google AI Studio. Data free tier dapat dipakai untuk peningkatan produk Google.
- Butuh akun OpenRouter gratis + `OPENROUTER_API_KEY`. Tidak ada biaya, tetapi ada **rate limit harian/menit** khas model free (bisa berubah; cek dashboard OpenRouter). Data pada model free dapat digunakan untuk pelatihan — jangan pakai data sensitif.
- **Test deterministik** (`halaman login tampil`, redirect `/dashboard`) memakai locator tanpa model dan selalu jalan.
- **Test agentic** (`agent: login dan dashboard tampil`) hanya jalan jika semua env ini tersedia:
  `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_MODEL`, dan `OPENROUTER_API_KEY`.
  Password dikirim sebagai `credentials` sehingga tidak masuk ke input model.
- Tanpa env tersebut, test agentic di-skip (bukan gagal).
- `e2e:check-model` memverifikasi model masih gratis, mendukung image/tools, dan endpoint provider online (uptime).
- Cache replay dan report ada di `.e2e/` (di-ignore dari git; diunggah sebagai artifact CI).
- Telemetry framework dimatikan lewat `E2E_TELEMETRY_DISABLED=1` di npm script.
- CI menjalankan job `e2e-agentic`; tambahkan `OPENROUTER_API_KEY` (secret) + `E2E_MODEL` (variable) di GitHub jika ingin agent test aktif.

## AI Test Runner (website menguji website lain)

SITester punya antrean **AI Test**: user mengisi URL target, tujuan, kriteria
berhasil, fitur/peran/siklus. Runner eksternal menjalankan e2e TesterArmy
terhadap target, lalu mengirim hasil + screenshot. Hasil masuk sebagai
**draft** yang harus dikonfirmasi lewat form pengujian (aturan retest tetap
berlaku).

**Login target per-run** (opsional):
- Centang **“Perlu login ke target”** di `/ai-test`.
- Isi URL login, email/password target, dan instruksi login.
- Isi ketiga label (`Email`, `Kata sandi`, `Masuk`) untuk login **deterministik**
  memakai `getByLabel`/`getByRole`; kosongkan untuk menyerahkan login ke agent AI.
- Kredensial disimpan **terenkripsi AES-256-GCM** di DB (`login_credentials_enc`),
  hanya dikirim ke runner untuk run tersebut, dan dihapus saat hasil dikirim.
- **Perhatian**: bila ketiga label login tidak diisi lengkap, agent AI melakukan
  login sendiri dan password target **dikirim ke provider model AI** (ikut dalam
  instruksi agent). Isi ketiga label agar login deterministik tanpa melibatkan model.
  Log runner disamarkan otomatis (`[redacted]`), tetapi jangan mengetik password
  di kolom tujuan/instruksi.
- Jika email/password per-run kosong, runner memakai fallback
  `AI_TARGET_EMAIL/PASSWORD`. Jika “Perlu login” tidak dicentang, login dilewati.
- Kunci enkripsi memakai `AI_CREDENTIALS_KEY` bila ada; di produksi kunci ini
  **wajib** (fallback ke `AI_RUNNER_TOKEN` hanya untuk dev). Rotasi token runner
  tanpa kunci khusus membuat kredensial lama tak terbaca.
- Runner boleh memakai token sendiri-sendiri lewat `AI_RUNNER_TOKENS`
  (daftar dipisah koma, tiap token ≥20 karakter) agar token tidak dipakai bersama.

**Trigger otomatis (opsional, disarankan)**
- Buat **fine-grained GitHub PAT** khusus repo `SiTester` dengan permission
  **Contents: Read and write** (dibutuhkan untuk `repository_dispatch`).
- Set di Vercel: `GITHUB_DISPATCH_TOKEN=<PAT>` (Production/Preview/Development),
  opsional `GITHUB_REPO=andYeap/SiTester`; lalu redeploy.
- Setiap `POST /api/v1/ai-runs` akan memicu workflow `repository_dispatch`
  (`ai-run`) sehingga runner mulai tanpa menunggu cron.
- Tanpa token, run tetap masuk antrean dan diambil oleh schedule/manual.
- GitHub-hosted runner tetap punya cold start ±30–90 detik; browser Chromium
  di-cache agar instalasi berikutnya lebih cepat.

**Audit log**

- Setiap run menyimpan output runner (stdout/stderr, error model, report e2e) di `ai_test_runs.runner_log` (maks 100.000 karakter).
- Di `/ai-test`, klik **Log** pada baris run untuk melihat penyebab kegagalan, termasuk langkah login/selector yang gagal.
- Log runner disamarkan otomatis: nilai kredensial diganti `[redacted]` sebelum
  disimpan, tetapi jangan mengetik password di kolom tujuan/instruksi. Log workflow lengkap juga tetap tersedia di GitHub Actions selama masa retensi artifact/log GitHub.
- Screenshot bukti tetap terpisah dan memerlukan Blob storage di produksi.

**Hemat kuota model gratis**
- Isi ketiga label login agar login deterministik — agent butuh langkah (token) jauh lebih sedikit.
- Tulis tujuan singkat dan kriteria berhasil yang spesifik; hindari halaman raksasa sebagai target.
- Urutkan `E2E_MODELS` dari yang paling murah/stabil; fallback otomatis hanya jalan saat error provider, bukan saat verdict `fail`.
- Jangan antrekan ulang run `fail` membabi buta — perbaiki dulu selektor/tujuan yang gagal di Log.
- Bila kuota harian OpenRouter habis, pindah `E2E_PROVIDER=google` (kuota gratis terpisah, tanpa kartu).
- Jadwal GitHub Actions tiap 5 menit + `repository_dispatch` membuat run cepat diambil tanpa runner 24 jam.

**Mengapa runner terpisah?** Vercel Functions tidak cocok menjalankan
Chromium penuh (ukuran/timeout). Vercel hanya menyimpan antrean dan hasil.

**Setup**
```env
# .env.local (lokal) dan Vercel (endpoint antrean)
AI_RUNNER_TOKEN=<string acak >= 20 karakter>
GITHUB_DISPATCH_TOKEN=<fine-grained PAT, Contents: Read and write>
GITHUB_REPO=andYeap/SiTester   # opsional

# .env.local runner / GitHub Secrets (jangan di Vercel)
E2E_PROVIDER=openrouter          # atau google
OPENROUTER_API_KEY=...           # jika provider openrouter
GOOGLE_GENERATIVE_AI_API_KEY=... # jika provider google
E2E_MODEL=nvidia/nemotron-3.5-super-vl:free   # google: gemini-3.8-flash

# opsional, fallback kredensial login target untuk semua run
# (dipakai hanya jika run mencentang "Perlu login" dan tidak mengisi kredensial)
AI_TARGET_EMAIL=...
AI_TARGET_PASSWORD=...
```

- **Lokal/24 jam**: jalankan `npm run ai-runner` di VPS/laptop yang selalu hidup.
- **Gratis tanpa VPS**: workflow `.github/workflows/ai-runner.yml` berjalan
  tiap 5 menit (schedule GitHub bisa tertunda) dan bisa dijalankan manual.
- **VPS gratis 24 jam**: Oracle Cloud Always Free (ARM) cocok untuk
  `npm run ai-runner` sebagai service systemd. GitHub Actions lebih mudah
  tetapi tidak real-time.
- Endpoint runner memakai `Authorization: Bearer AI_RUNNER_TOKEN`; token harus
  sama di Vercel dan runner/GitHub.
- **Wajib di Vercel**: Project → Settings → Environment Variables →
  `AI_RUNNER_TOKEN` (Production/Preview/Development), lalu redeploy. Tanpa ini
  endpoint AI mengembalikan 401 dan workflow runner dilewati dengan peringatan.
- Target boleh publik atau localhost/internal — karena browser berjalan di
  mesin runner, bukan Vercel.
- **Keamanan**: agent dapat dipengaruhi konten website target (prompt
  injection). Gunakan akun tester khusus dengan hak minimal; jangan pakai akun
  admin produksi. Jangan menguji situs yang tidak Anda miliki/izin.

Alur: `/ai-test` → antre → runner → hasil + bukti → `Konfirmasi` →
`/pengujian-baru?ai_run=...` (prefill) → simpan.

## Batas import

- Format: `.xlsx` dan `.csv` (`.xls` lama tidak didukung).
- Maks **2MB** dan **5.000 baris**. 2MB adalah batas aman agar commit selesai dalam `maxDuration` 60 detik Vercel.
- Untuk file lebih besar: pecah menjadi beberapa file, atau (perlu pengembangan) unggah langsung ke Vercel Blob lalu import dari URL.
- Import hanya untuk ketua; baris duplikat (hash sama) otomatis dilewati.

## Deploy ke Vercel (gratis, tanpa kartu kredit)

1. **Database**: buat Postgres gratis (Neon direkomendasikan). Simpan dua URL:
   - pooled (`...-pooler...`) → `DATABASE_URL` untuk runtime serverless
   - direct → dipakai sekali saat migrasi/seed
2. **Environment variables** di Vercel:
   - `DATABASE_URL` (pooled), `PG_POOL_MAX=3`
   - `BLOB_READ_WRITE_TOKEN` (**wajib** untuk unggah bukti di produksi; tanpa ini upload ditolak dengan pesan jelas)
   - Opsional notifikasi: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
3. **Migrasi & seed** dari mesin lokal, arahkan ke direct URL:
   ```bash
   DATABASE_URL='postgres://...direct...' npm run db:migrate
   DATABASE_URL='postgres://...direct...' npm run db:seed   # opsional
   ```
4. **Deploy**: hubungkan repo ke Vercel (framework terdeteksi otomatis). Tidak perlu `vercel.json`.

Catatan produksi:
- Cookie otomatis `Secure` karena `NODE_ENV=production`.
- Sesi disimpan di database, logout benar-benar mencabut akses.
- Jangan set `PG_POOL_MAX` tinggi di serverless.

## Backup mingguan (disarankan)

Jadwalkan cron mingguan di mesin yang punya docker + akses DB:

```cron
0 2 * * 0 cd /path/ke/sitester && DATABASE_URL='postgres://...' ./scripts/backup.sh >> backups/backup.log 2>&1
```

Restore ke database kosong (sudah terverifikasi):

```bash
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -v "$PWD/backups:/b:ro" postgres:16-alpine \
  pg_restore --clean --if-exists -d "$DATABASE_URL" /b/<file-dump>
```

## Skrip

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build + production server |
| `npm test` | Semua test: unit + API (butuh Postgres; default DB `testlab_test` lokal, override via `TEST_DATABASE_URL`) |
| `npm run test:api` | Hanya test API |
| `npm run test:e2e` | Playwright E2E (login/proteksi route + regresi UI M4/M5/M8; DB terisolasi `testlab_e2e`, disiapkan otomatis) |
| `npm run db:migrate` | Terapkan migrasi berversi (`db/migrations/*.sql`, tercatat di `schema_migrations`) |
| `npm run db:seed` | Data demo (idempoten) |
| `npm run db:cleanup` | Hapus token/permohonan/login_attempts kedaluwarsa |
| `DATABASE_URL=... ./scripts/backup.sh` | Backup DB (pg_dump via docker ke `backups/`) |
| `npm run lint` | ESLint |

> **Penting soal `.env`**: JANGAN membuat file bernama `.env` di folder ini.
> Node `--env-file` dan Next.js menggabungkan `.env` + `.env.local` dengan
> aturan prioritas BERBEDA per tool — akibatnya perintah migrate bisa lari
> ke database production sementara web server lari ke lokal (atau sebaliknya).
> Kredensial Neon disimpan di `.env.neon` (tidak pernah dibaca otomatis);
> pakai eksplisit per perintah, contoh:
> `DATABASE_URL="$(grep ^DATABASE_URL .env.neon | cut -d= -f2-)" npm run db:migrate`
