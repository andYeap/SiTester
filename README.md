# SITester — pencatatan pengujian tim tester (Next.js + Postgres, siap Vercel)

Rewrite dari aplikasi TestLab versi Laravel (`../testlab`). Paritas fitur penuh + deploy gratis.
Lihat `PRD.md` (spesifikasi v2) dan `PLAN.md` (rencana implementasi).

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

## Deploy ke Vercel (gratis, tanpa kartu kredit)

1. **Database**: buat Postgres gratis (Neon direkomendasikan). Simpan dua URL:
   - pooled (`...-pooler...`) → `DATABASE_URL` untuk runtime serverless
   - direct → dipakai sekali saat migrasi/seed
2. **Environment variables** di Vercel:
   - `DATABASE_URL` (pooled), `PG_POOL_MAX=5`
   - `BLOB_READ_WRITE_TOKEN` (wajib untuk unggah bukti di Vercel; tanpa ini upload gagal dengan pesan jelas — bukan cuma di dev)
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

## Skrip

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build + production server |
| `npm test` | Semua test: unit + API (butuh Postgres; default DB `testlab_test` lokal, override via `TEST_DATABASE_URL`) |
| `npm run test:api` | Hanya test API |
| `npm run db:migrate` | Terapkan skema (idempoten) |
| `npm run db:seed` | Data demo (idempoten) |
| `npm run lint` | ESLint |
