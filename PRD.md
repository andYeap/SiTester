# PRD: SITester (Sistem Pengujian Tim Tester) — v2

**Versi:** 2.0 · **Tanggal:** 29 Oktober 2026 · **Stack:** Next.js 16 + Postgres + Vercel
**Status implementasi:** selesai di repo ini (7/7 task PLAN.md) · **Supersedes:** `../testlab/PRD-sistem-pengujian-tim.md` (Laravel 12 + MySQL — tetap jalan, tidak dihapus)

---

## 1. Ringkasan Produk

Website internal untuk mencatat aktivitas pengujian fitur secara berkelompok, menggantikan Excel. Mengelola siapa menguji apa, kapan, dalam peran dan siklus apa, status hasil (Pass/Fail/Bug + severity), validasi **pengujian ulang** per peran per siklus yang memerlukan persetujuan ketua tim, dan menampilkan grafik masa/hasil pengujian plus ekspor laporan.

### Masalah yang diselesaikan
- Pencatatan Excel rentan duplikat, sulit digabung, tidak ada validasi.
- Belum ada kontrol ketika fitur yang sama diuji ulang tanpa koordinasi.
- Grafik/laporan harus dibuat manual setiap periode.
- Deploy Laravel butuh server PHP + MySQL selalu-on; versi ini deploy gratis di Vercel + Postgres free.

### Sasaran (Goals)
1. Satu form pengujian yang terstruktur dan cepat diisi.
2. Sistem pengingat & persetujuan otomatis untuk pengujian ulang (per peran, per siklus).
3. Visibilitas real-time masa dan hasil pengujian lewat dashboard.
4. Ekspor laporan CSV & PDF agar transisi dari Excel tidak terasa kehilangan fitur.
5. Deploy $0: Vercel free + Postgres free, tanpa kartu kredit.

---

## 2. Peran Pengguna (Roles)

| Role (aplikasi diuji) | Dikelola | Keterangan |
|---|---|---|
| `super_admin`, `admin_instansi`, `tester`, ... | Menu Peran Uji (ketua) | Peran di aplikasi yang diuji; master data, tambah/nonaktif tanpa edit kode |

| Role (pengguna TestLab) | Hak Akses |
|---|---|
| **Tester** | Isi form pengujian, lihat data miliknya + grafik, ajukan pengujian ulang, usul fitur baru |
| **Ketua Tim** | Semua hak Tester + setujui/tolak permohonan, lihat semua data, kelola fitur/pengguna/peran/siklus, verifikasi usulan fitur |

Autentikasi: login email + password, sesi opak di cookie httpOnly (hash scrypt, token SHA-256 di DB). Sesi 8 jam; opsi "Ingat saya" 30 hari (tidak untuk komputer bersama). Satu akun satu sesi aktif (login baru mencabut sesi lama).

---

## 3. Fitur Utama

### F1 — Form Pengujian
Field: **Tanggal Pengujian** (≤ hari ini), **Pengujian Ulang?** (ya/tidak), **Diuji sebagai peran** (dropdown master), **Siklus** (dropdown master, opsional; menampilkan instruksi + menyaring fitur ke lingkup bila ada), **Proyek** (filter dropdown, opsional), **Fitur** (combobox cari + grup per proyek; cocok nama/deskripsi/proyek), **Status Hasil** (`Pass`/`Fail`/`Bug`), **Severity** (wajib bila Fail/Bug), **Lingkungan**, **Diharapkan**, **Terjadi**, **Catatan** (wajib ≥10 karakter bila Fail/Bug), **Bukti** (file ≤2MB dan/atau URL).

Aturan: Pass tanpa retest → blokir bila sudah Pass dalam scope; Pass + retest → butuh approval aktif; Fail/Bug → otomatis boleh. Bila siklus punya lingkup fitur, submit di luar lingkup ditolak (422) dengan arahan.

### F2 — Kontrol Pengujian Ulang (sumber kebenaran)
Scope = **(fitur, peran, siklus)**. Siklus kosong = scope legacy (fitur, peran).
- Belum ada hasil dalam scope → selalu boleh.
- Hasil terakhir scope = Fail/Bug → boleh otomatis (bug-fix cycle).
- Hasil terakhir scope = Pass + retest → butuh approval single-use (fitur, peminta, peran).
- Permohonan pending duplikat (fitur + peran) ditolak; antrean pending lintas siklus.
- Peringatan non-blokir: fitur sama diuji tester lain 24 jam terakhir.

### F3 — Notifikasi In-App
Ketua: permohonan baru. Tester: keputusan + alasan. Bell navbar + halaman `/notifikasi`.

### F4 — Dashboard & Grafik
Kartu (total/Pass/Fail-Bug bulan ini, fitur belum diuji dalam filter), bar masa pengujian (7/30 hari + filter siklus), donut distribusi, top fitur + status terakhir. Bila siklus dipilih: banner instruksi siklus, progress "X dari Y fitur teruji", dan daftar fitur lingkup yang belum diuji. Data dari `GET /api/dashboard/stats?range&cycle` (termasuk `brief` + `scope`).

### F5 — Riwayat
Filter: tanggal range, tester (ketua), fitur, hasil, teks, siklus. Kolom: tanggal, tester, peran, siklus, fitur, hasil, severity, ulang, disetujui-oleh, bukti, catatan. Append-only.

### F6 — Ekspor
CSV via API (ikut filter aktif). PDF satu-klik client-side (jspdf + autotable) dari data terfilter. Riwayat paginasi (50/halaman). Tombol di Riwayat.

### F7 — Master Data
- **Fitur**: semua auth boleh usul (langsung aktif + `verified=false` + tercatat pembuat); ketua verifikasi/edit/hapus. Duplikat ditolak case-insensitive. Hapus ditolak bila dipakai riwayat.
- **Peran Uji**: penuh ketua. Hapus ditolak bila dipakai riwayat.
- **Proyek**: penuh ketua. Daftar master tunggal sumber kebenaran nama proyek; dropdown di form pengujian + form fitur mengambil dari sini (menggantikan teks bebas). Ganti nama ikut mengubah fitur terkait (transaksional). Hapus ditolak bila masih dipakai fitur (nonaktifkan atau pindahkan dulu).
- **Siklus**: penuh ketua. Setiap siklus punya **lingkup fitur** (opsional; kosong = semua fitur aktif) dan **instruksi untuk tester** (tampil mencolok di form + dashboard saat siklus dipilih). Siklus nonaktif hilang dari dropdown tapi riwayat tetap. Tes pertama di siklus baru selalu boleh (ronde fresh). Form pengujian otomatis menyaring daftar fitur ke lingkup bila ada; dashboard menampilkan progress lingkup + daftar yang belum diuji.
- **Pengguna**: penuh ketua; tidak bisa hapus diri sendiri.

### F8 — Audit Aktivitas Master
Semua create/update/delete (dan verifikasi) fitur, peran, siklus, pengguna tercatat (siapa, kapan, aksi, target, perubahan — tanpa password). Halaman `/aktivitas` khusus ketua + filter teks/aksi.

---

## 4. Aturan Bisnis

| # | Aturan |
|---|---|
| BR-1 | Fitur Pass dalam scope tidak bisa diuji ulang tanpa approval aktif |
| BR-2 | Hasil terakhir Fail/Bug boleh diuji ulang otomatis |
| BR-3 | Approval single-use per (fitur, peminta, peran), konsumsi atomik, kedaluwarsa 7 hari |
| BR-4 | Submit retest tanpa approval aktif → ditolak (422) |
| BR-5 | Tanggal tidak boleh > hari ini (zona waktu Asia/Jakarta) |
| BR-6 | Fail/Bug wajib catatan ≥10 karakter + severity |
| BR-7 | Permohonan pending ganda (fitur + peran) ditolak; permohonan kedaluwarsa 7 hari |
| BR-8 | Riwayat append-only |
| BR-9 | Login dibatasi: 10x gagal / 15 menit per email → 429 |
| BR-10 | Satu akun hanya boleh punya 1 sesi aktif; login baru mencabut sesi lama |

---

## 5. Non-Fungsional
- Guard server di setiap route/API: tester vs ketua; tester hanya data miliknya (kecuali agregat tim + daftar master untuk dropdown). Bukti upload hanya bisa diakses saat login.
- Semua tanggal/logika harian memakai zona waktu Asia/Jakarta.
- Indeks: `(feature_id, tested_as_role, tested_at)`, `(feature_id, tested_as_role, status)`, `(test_cycle, tested_at)`, `(severity)`.
- Pool Postgres `PG_POOL_MAX=5` di serverless; SSL non-lokal.
- Upload: Vercel Blob bila token ada, else disk lokal (dev).
- Header keamanan: nosniff, same-origin referrer, DENY framing, HSTS, Permissions-Policy minimal.
- Backup DB mingguan via `scripts/backup.sh` (pg_dump format custom; restore terverifikasi).

---

## 6. Out of Scope (v2)
Multi-proyek multi-tim enterprise, SSO, notifikasi email, komentar diskusi, multi-file attachment (1 file + 1 URL), otomasi eksekusi test case.

---

## 7. Rencana Implementasi
Lihat `PLAN.md` (fondasi DB+seed → auth+shell → aturan retest+unit test → master → form+retest+notifikasi → riwayat+dashboard → export+bukti+deploy docs → hardening lanjutan).

## 8. Verifikasi
- `npx vitest run` hijau (aturan retest).
- Manual: Pass→blokir→ajukan→setujui→retest lolos; Fail→langsung; lintas peran tidak saling blokir; siklus baru fresh; filter R1 vs R2; CSV/PDF cocok filter.
- Deploy: push → Vercel build hijau; migrasi ke Neon; login demo jalan di URL produksi.
