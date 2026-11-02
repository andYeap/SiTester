# SITester — pencatatan & kendali pengujian tim tester (Next.js + Postgres, siap Vercel)

Rewrite dari aplikasi TestLab versi Laravel (`../testlab`). Paritas fitur penuh + deploy gratis.
Lihat `PRD.md` (spesifikasi v3), `PLAN-v3.md` (rencana), dan `DESIGN.md`.

## Fitur v3

- Form pengujian dengan **draft otomatis**, triase progresif (severity hanya saat Fail/Bug), dan **mode cepat** multi-hasil.
- Retest per (fitur, peran, siklus) + approval single-use 7 hari; notifikasi in-app + **email/Telegram opsional**.
- **Tugas Saya**: fitur belum diuji, permohonan retest, defect terbuka.
- **Test case** per fitur + **defect lifecycle** (open → fixed → verified → closed).
- **Detail fitur**: test case, defect, dan timeline sesi.
- Riwayat: sort, preset tanggal, filter tersimpan, kartu mobile.
- **Import Excel/CSV** dengan pratinjau + commit transaksional.
- Ekspor CSV/PDF **mengikuti filter** (PDF seluruh hasil, bukan satu halaman).
- Akun: lupa password, reset password token 24 jam, tautan reset dari ketua.
- Hardening: upload magic-bytes, rate limit email+IP, health check, CI, E2E.

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
| `npm run test:e2e` | Playwright E2E (login/proteksi route) |
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
