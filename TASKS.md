# Task Audit SITester — 2026-11-04

Sumber: audit pada HEAD `9fb8159`.
Status: **selesai dikerjakan** (2026-11-04). Semua item di bawah sudah fix + test.

Definition of done tiap task:

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

---

## Penting

- [x] **P1 — Batasi update defect ke pembuat atau ketua**
  - Lokasi: `src/app/api/v1/defects/[id]/route.ts:27-33,56`
  - Dampak: tester mana pun bisa mengubah `status`/`assignee`/`note` defect milik tester lain; menyimpang dari tabel peran PRD.
  - Fix: ikutkan `created_by` di `SELECT`; tolak `403` bila `user.role !== "ketua_tim" && existing.created_by !== user.id`.
  - Test: tester B tidak boleh PATCH defect tester A; ketua boleh.

- [x] **P2 — Samakan semantik scope "tanpa siklus"**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:217-230`, `src/app/api/v1/features/[id]/can-test/route.ts:56-69`, `src/app/api/v1/retest-requests/route.ts:80-103`
  - Dampak: `Pass` di siklus R1 memblokir pengujian tanpa siklus, sedangkan approval mencari scope `NULL` secara exact. Membingungkan dan menyimpang dari BR (fitur, peran, siklus).
  - Keputusan: **exact** — `test_cycle IS NOT DISTINCT FROM $n`; "tanpa siklus" hanya mencocokkan baris tanpa siklus.
  - Fix: samakan pola query `test_cycle IS NOT DISTINCT FROM $n` di ketiga tempat.
  - Test: pass di R1 tidak memblokir test tanpa siklus; permohonan retest tanpa siklus ditolak bila Pass hanya ada di siklus.

---

## Minor

- [x] **M1 — Idempotency key unik per user**
  - Lokasi: `db/schema.sql:324-325`, `src/app/api/v1/test-sessions/route.ts:71,323`
  - Fix: index unik `(user_id, idempotency_key)`; lookup/conflict handling tetap per user.
  - Migrasi: `db/migrations/0012_idempotency_per_user.sql`.

- [x] **M2 — Privatkan bukti uji**
  - Lokasi: `src/lib/storage.ts:56`, `src/app/api/uploads/[...path]/route.ts:48`
  - Fix: Blob privat + route proxy ber-auth; `Cache-Control: private, no-store` untuk route lokal. Bila store publik, fallback ke URL UUID (komentar `shortcut:` di kode).

- [x] **M3 — Jangan kirim pesan error DB mentah**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:333`, catch di `src/app/api/v1/import/commit/route.ts`
  - Fix: petakan ke pesan generik; detail ke `console.error`.

- [x] **M4 — Draft tidak muncul lagi setelah simpan**
  - Lokasi: `src/components/pengujian/PengujianForm.tsx:269,327-332`
  - Fix: flag `cleared` atau lewati autosave saat state sengaja dikosongkan.

- [x] **M5 — Alasan retest dari UI tidak pernah terisi**
  - Lokasi: `src/components/pengujian/PengujianForm.tsx:514-523`
  - Fix: tambah textarea alasan, atau hapus parameter `reason` yang selalu `null`.

- [x] **M6 — Validasi kecocokan AI run dengan sesi**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:167-197`
  - Fix: ikut `SELECT feature_id, tested_as_role, test_cycle`; bandingkan dengan sesi yang disubmit.

- [x] **M7 — `can-test` ikut menegakkan lingkup siklus**
  - Lokasi: `src/app/api/v1/features/[id]/can-test/route.ts` vs `test-sessions/route.ts:109-135`
  - Fix: cek `cycle_features`; jika fitur di luar scope, kembalikan `allowed:false`.

- [x] **M8 — Dashboard: permohonan kedaluwarsa + label role**
  - Lokasi: `src/lib/stats.ts:232`, `src/components/dashboard/DashboardView.tsx:93`
  - Fix: tampilkan permohonan kedaluwarsa (PRD F4); bedakan label "tim" vs "saya" untuk tester.

- [x] **M9 — Rate limit forgot-password**
  - Lokasi: `src/app/api/auth/forgot-password/route.ts`
  - Fix: batasi per email/IP; hindari token thrash + email spam.

- [x] **M10 — Cegah dua `Pass` bersamaan**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:217-233`
  - Fix: kunci scope di dalam transaksi (advisory lock per fitur+role+siklus) sebelum cek `last`.

- [x] **M11 — Tambahkan `.env.example`**
  - Lokasi: `README.md:40`, `.gitignore:34`
  - Fix: buat `.env.example` + `!.env.example`; pastikan setup README jalan.

- [x] **M12 — Bersihkan route/halaman mati**
  - Lokasi: `src/app/page.tsx`, `src/proxy.ts:11-26,45-53`
  - Fix: hapus halaman starter; masukkan `/ai-test` ke `isAppRoute`; hapus `/profil` dari matcher atau buat halamannya.

- [x] **M13 — Tambah regression test**
  - Test: defect lintas user (P1), scope `NULL` (P2), idempotency lintas user (M1).

- [x] **M14 — Akurasi label "24 jam terakhir"**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:339`
  - Fix: `tested_at` hanya tanggal (tanpa jam), jadi label diubah menjadi "sejak kemarin" (mencakup hari ini + kemarin) agar tidak mengklaim 24 jam yang tidak bisa dihitung.

- [x] **M15 — Tangani error parsing di `import/errors`**
  - Lokasi: `src/app/api/v1/import/errors/route.ts:48`
  - Fix: bungkus `parseAndValidate` dan kembalikan `422`, bukan `500`.

- [x] **M16 — Transaksionalkan reject retest**
  - Lokasi: `src/app/api/v1/retest-requests/[id]/reject/route.ts:27-44`
  - Fix: `FOR UPDATE` + update dalam transaksi agar tidak balapan dengan approve.

---

## Bukan task

- **Import append-only** — sengaja tidak menerapkan aturan retest (PRD F10).
- **Tambah fitur baru** — tidak perlu; fitur PRD sudah tercakup.
- **Refactor besar / ganti arsitektur** — tidak perlu; fokus pada P1/P2 dan minor di atas.

---

## Tindak lanjut AI Testing (2026-11-04)

- [x] **A1 — Peringatan password ke model** — `AiRunsView.tsx`: hint saat label login tak lengkap; koreksi klaim "tidak pernah masuk prompt/model" di `README.md`/`PRD.md`.
- [x] **A2 — Report hilang = error** — `scripts/ai-runner.mjs`: `report === null` → outcome `error`, bukan `fail`.
- [x] **A3 — Redaksi kredensial di log** — `scripts/ai-runner.mjs`: nilai email/password disamarkan jadi `[redacted]` sebelum disimpan.
- [x] **A4 — Kunci kredensial wajib di produksi** — `src/lib/ai-credentials.ts`: tanpa `AI_CREDENTIALS_KEY`, `NODE_ENV=production` → fail-closed.
- [x] **A5 — Heartbeat runner** — `POST /api/v1/ai-runs/[id]/heartbeat` tiap 5 menit; reclaim 15 menit hanya untuk runner mati.
- [x] **A6 — Token per-runner** — `AI_RUNNER_TOKENS` (koma) diterima `src/lib/runner-auth.ts`.
- [x] **A7 — Kuota MAX_PENDING anti-balapan** — `pg_advisory_xact_lock` per user di `POST /api/v1/ai-runs` + tes konkuren.
