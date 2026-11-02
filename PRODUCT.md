# PRODUCT.md — SITester v3

**Nama:** SITester — Sistem Pencatatan & Kendali Pengujian Tim Tester.

**Misi:** Menggantikan Excel dengan alur pengujian yang cepat dicatat, terkontrol aturannya, dan langsung terlihat kualitasnya.

**Pengguna:**
- **Tester** (non-teknis): mencatat hasil uji harian, memilih test case, mengajukan retest, mengelola draft form, melihat antrean "Tugas Saya", mengusulkan fitur, dan melacak defect yang ia temukan.
- **Ketua tim penguji**: semua hak tester + menyetujui/menolak retest, mengelola master (fitur, peran, proyek, siklus, test case, pengguna), import Excel, membuat tautan reset akun, memverifikasi fitur/defect, dan mengekspor laporan.

**Ruang lingkup v3:**
1. Form pengujian dengan progressive disclosure, draft otomatis, dan mode cepat multi-hasil.
2. Kontrol retest per (fitur, peran, siklus) + approval single-use.
3. Tugas Saya: daftar kerja per siklus (belum diuji, permohonan, defect).
4. Dashboard + riwayat dengan sort, preset tanggal, filter tersimpan, dan tampilan mobile.
5. Test case per fitur + siklus hidup defect (open → fixed → verified → closed).
6. Detail fitur: test case, defect, dan timeline pengujian.
7. Import Excel/CSV dengan pratinjau & validasi per baris.
8. Ekspor CSV/PDF yang konsisten mengikuti filter.
9. Akun mandiri: lupa/reset password + tautan reset dari ketua.
10. Notifikasi in-app + email/Telegram opsional.
11. Master data lengkap + audit aktivitas.

**Batasan / anti-tujuan:**
- Bukan multi-tenant/SSO, bukan diskusi realtime, bukan multi-lampiran (1 gambar + 1 URL), bukan otomasi test runner.
- Riwayat append-only; approval hangus setelah dipakai; satu akun satu sesi aktif.
- Tetap murah: Vercel free + Postgres free.

**Nada visual (diperbarui):**
- Monokrom hitam/putih; status dibedakan lewat label teks + bentuk border, bukan warna.
- Bahasa Indonesia yang jelas; istilah teknis dijelaskan singkat.
- Navigasi sidebar kiri; topbar hanya untuk menu mobile + notifikasi.
- Setiap keadaan kosong memberi langkah berikutnya; target sentuh ≥44px; fokus keyboard terlihat.
