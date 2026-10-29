# PRODUCT.md — SITester

**Nama:** SITester — Sistem Pencatatan Pengujian Tim Tester.

**Misi (satu kalimat):** Menggantikan pencatatan pengujian di Excel dengan satu form terstruktur yang cepat diisi, terkontrol, dan langsung terlihat di dashboard.

**Pengguna:**
- **Tester** (pengguna internal non-teknis): mencatat hasil uji harian, mengajukan pengujian ulang, mengusulkan fitur baru, melihat data miliknya + grafik tim.
- **Ketua tim penguji**: semua hak tester + menyetujui/menolak permohonan ulang, mengelola master (fitur, peran uji, siklus, pengguna), memverifikasi usulan fitur, mengekspor laporan.

**Ruang lingkup v2:**
1. Form pengujian 14 field dengan validasi pengujian ulang otomatis per (fitur, peran, siklus).
2. Alur persetujuan pengujian ulang sekali pakai + notifikasi dalam aplikasi.
3. Dashboard (kartu ringkasan, grafik masa 7/30 hari, donut hasil, fitur tersering diuji) dengan filter siklus.
4. Riwayat append-only dengan filter + ekspor CSV/PDF.
5. Master data: fitur (usulan tester → verifikasi ketua), peran uji, siklus, pengguna.

**Batasan / anti-tujuan:**
- Bukan multi-proyek multi-tim, bukan SSO, bukan notifikasi email.
- Bukan diskusi/komentar, bukan multi-lampiran (1 gambar + 1 URL), bukan otomasi test-case.
- Riwayat tidak bisa diubah/dihapus; persetujuan hangus setelah dipakai satu kali.
- Deploy murah: Vercel free + Postgres free.

**Nada visual:**
- Bahasa Indonesia yang jelas untuk non-teknis; istilah asing (Pass/Fail/Bug, severity) dijelaskan seperlunya.
- Tenang dan rapi: kartu putih di atas latar abu kebiruan, aksen indigo/violet, status berwarna (hijau Pass, merah Fail, oranye Bug).
- Hierarki tegas: judul halaman → kartu ringkasan → filter → data. Negara kosong selalu diberi tahu harus ngapain berikutnya.
