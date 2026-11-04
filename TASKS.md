# Task Audit SITester — 2026-11-04

Sumber: audit pada HEAD `9fb8159` (10 commit belum di-push saat task dibuat).
Status: **belum dikerjakan**. Centang setelah fix + test.

Definition of done tiap task:

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

---

## Penting

- [ ] **P1 — Batasi update defect ke pembuat atau ketua**
  - Lokasi: `src/app/api/v1/defects/[id]/route.ts:27-33,56`
  - Dampak: tester mana pun bisa mengubah `status`/`assignee`/`note` defect milik tester lain; menyimpang dari tabel peran PRD.
  - Fix: ikutkan `created_by` di `SELECT`; tolak `403` bila `user.role !== "ketua_tim" && existing.created_by !== user.id`.
  - Test: tester B tidak boleh PATCH defect tester A; ketua boleh.

- [ ] **P2 — Samakan semantik scope "tanpa siklus"**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:217-230`, `src/app/api/v1/features/[id]/can-test/route.ts:56-69`, `src/app/api/v1/retest-requests/route.ts:80-103`
  - Dampak: `Pass` di siklus R1 memblokir pengujian tanpa siklus, sedangkan approval mencari scope `NULL` secara exact. Membingungkan dan menyimpang dari BR (fitur, peran, siklus).
  - Keputusan: **exact** (rekomendasi, sesuai PRD) atau **wildcard** (ubah approval/pending juga + label UI).
  - Fix: samakan pola query `test_cycle IS NOT DISTINCT FROM $n` di ketiga tempat.
  - Test: pass di R1 tidak memblokir test tanpa siklus (jika exact); approval R1 tidak membuka retest `NULL`.

---

## Minor

- [ ] **M1 — Idempotency key unik per user**
  - Lokasi: `db/schema.sql:324-325`, `src/app/api/v1/test-sessions/route.ts:71,323`
  - Fix: index unik `(user_id, idempotency_key)`; sesuaikan lookup/conflict handling.

- [ ] **M2 — Privatkan bukti uji**
  - Lokasi: `src/lib/storage.ts:56`, `src/app/api/uploads/[...path]/route.ts:48`
  - Fix: Blob privat + signed URL; `Cache-Control: private, no-store` untuk route lokal.

- [ ] **M3 — Jangan kirim pesan error DB mentah**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:333`, catch di `src/app/api/v1/import/commit/route.ts`
  - Fix: petakan ke pesan generik; detail ke `console.error`.

- [ ] **M4 — Draft tidak muncul lagi setelah simpan**
  - Lokasi: `src/components/pengujian/PengujianForm.tsx:269,327-332`
  - Fix: flag `cleared` atau lewati autosave saat state sengaja dikosongkan.

- [ ] **M5 — Alasan retest dari UI tidak pernah terisi**
  - Lokasi: `src/components/pengujian/PengujianForm.tsx:514-523`
  - Fix: tambah textarea alasan, atau hapus parameter `reason` yang selalu `null`.

- [ ] **M6 — Validasi kecocokan AI run dengan sesi**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:167-197`
  - Fix: ikut `SELECT feature_id, tested_as_role, test_cycle`; bandingkan dengan sesi yang disubmit.

- [ ] **M7 — `can-test` ikut menegakkan lingkup siklus**
  - Lokasi: `src/app/api/v1/features/[id]/can-test/route.ts` vs `test-sessions/route.ts:109-135`
  - Fix: cek `cycle_features`; jika fitur di luar scope, kembalikan `allowed:false`.

- [ ] **M8 — Dashboard: permohonan kedaluwarsa + label role**
  - Lokasi: `src/lib/stats.ts:232`, `src/components/dashboard/DashboardView.tsx:93`
  - Fix: tampilkan permohonan kedaluwarsa (PRD F4); bedakan label "tim" vs "saya" untuk tester.

- [ ] **M9 — Rate limit forgot-password**
  - Lokasi: `src/app/api/auth/forgot-password/route.ts`
  - Fix: batasi per email/IP; hindari token thrash + email spam.

- [ ] **M10 — Cegah dua `Pass` bersamaan**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:217-233`
  - Fix: kunci scope di dalam transaksi (advisory lock per fitur+role+siklus) sebelum cek `last`.

- [ ] **M11 — Tambahkan `.env.example`**
  - Lokasi: `README.md:40`, `.gitignore:34`
  - Fix: buat `.env.example` + `!.env.example`; pastikan setup README jalan.

- [ ] **M12 — Bersihkan route/halaman mati**
  - Lokasi: `src/app/page.tsx`, `src/proxy.ts:11-26,45-53`
  - Fix: hapus halaman starter; masukkan `/ai-test` ke `isAppRoute`; hapus `/profil` dari matcher atau buat halamannya.

- [ ] **M13 — Tambah regression test**
  - Test: defect lintas user (P1), scope `NULL` (P2), idempotency lintas user (M1).

- [ ] **M14 — Akurasi label "24 jam terakhir"**
  - Lokasi: `src/app/api/v1/test-sessions/route.ts:339`
  - Fix: hitung `now() - interval '24 hours'`, bukan `date - 1`.

- [ ] **M15 — Tangani error parsing di `import/errors`**
  - Lokasi: `src/app/api/v1/import/errors/route.ts:48`
  - Fix: bungkus `parseAndValidate` dan kembalikan `422`, bukan `500`.

- [ ] **M16 — Transaksionalkan reject retest**
  - Lokasi: `src/app/api/v1/retest-requests/[id]/reject/route.ts:27-44`
  - Fix: `FOR UPDATE` + update dalam transaksi agar tidak balapan dengan approve.

---

## Bukan task

- **Import append-only** — sengaja tidak menerapkan aturan retest (PRD F10).
- **Tambah fitur baru** — tidak perlu; fitur PRD sudah tercakup.
- **Refactor besar / ganti arsitektur** — tidak perlu; fokus pada P1/P2 dan minor di atas.
