# DESIGN.md — SITester

Sistem desain hasil design-pass (diadaptasi dari PRD.md v2, bukan duplikasi).

## 1. Token warna

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--color-brand-500/600/700` | `#6366f1` / `#4f46e5` / `#4338ca` | Aksi primer (gradien `from-indigo-600 to-violet-600`), grafik bar, badge "Baru"/unread |
| `--color-brand-50/100` | `#eef2ff` / `#e0e7ff` | Latar tombol sekunder, ikon empty-state |
| Latar aplikasi | `#eef2f7` | `body`, kontras lembut terhadap kartu putih |
| Teks | `slate-900` judul, `slate-700/600` isi, `slate-500/400` sekunder | Jangan pakai `gray-*` untuk teks — pemindai mata mengandalkan satu skala |
| Status | hijau `green-100/700` Pass · merah `red-100/700` Fail · oranye `orange-100/700-800` Bug/severity · `amber-*` peringatan retest · `indigo-*` info/ulang | Selalu pasangkan warna + label teks (jangan warna saja) |
| Navbar | gradien `from-indigo-950 via-indigo-900 to-slate-900` | Satu-satunya permukaan gelap |

## 2. Kelas komponen bersama (`src/app/globals.css`)

| Kelas | Kapan memakai | Jangan untuk |
|---|---|---|
| `.card` / `.card-pad` | Semua panel: statistik, filter, form, tabel | Jangan rakit `rounded-2xl border … shadow` manual |
| `.page-title` / `.page-subtitle` | Setiap halaman: judul + satu baris penjelasan konteks | Sub-judul seksi pakai `font-semibold text-slate-700` |
| `.btn-primary` | Satu aksi utama per halaman (Masuk, Catat Pengujian) | Aksi destruktif |
| `.btn-dark` | Aksi ketua/tambah/filter (netral tegas) | Aksi utama halaman login/form |
| `.btn-soft` | Aksi sekunder netral (Unduh PDF, Tandai dibaca) | Jangan merah untuk aksi netral |
| `.btn-success-solid` | Hanya Setujui / Unduh CSV | Jangan untuk aksi biasa |
| `.btn-danger-soft` | Hanya Tolak | Jangan untuk ekspor/cetak |
| `.icon-btn` | Tombol ikon (bel notifikasi) — target ≥44px | Tautan teks |
| `.action-link` | Aksi teks di tabel (Edit/Hapus/Verifikasi, Buka bukti) — min 44px + fokus jelas | Tombol utama |
| `.label` (+ `htmlFor`/`id`) / `.hint` | Semua label form; `.hint` untuk aturan bantu (wajib Fail/Bug) | Label filter kecil boleh `label text-xs` |
| `.input` / `.input-file` | Semua kontrol form; file pakai `.input-file` (tombol pilih gaya) | Jangan `rounded-md border-gray-300` mentah |
| `.table-head` / `.table-th` (+ `scope="col"`) | Semua tabel + `caption.sr-only` | — |
| `.badge` (+ warna status) | Semua pil status | Jangan rakit `rounded px-2…` manual |
| `.alert-ok/err/warn/info` + `role` | Umpan balik; `role="alert"` untuk error, `role="status"` untuk sukses/muat | Info cek-retest pakai alert, bukan `bg-yellow-50` manual |
| `.empty-state` + `.empty-icon/title/hint` | Semua keadaan kosong + CTA langkah berikutnya | Jangan teks polos "Belum ada data." |
| `.skeleton` | Pengganti area muat (dashboard, riwayat) — kilau mati saat `prefers-reduced-motion` | Jangan spinner baru/lib baru |

Aturan tombol: semua `.btn-*` punya `min-h-11` (44px) dan `focus-visible:ring`; pil kecil (rentang 7/30 hari) juga `min-h-11` + `aria-pressed`.

## 3. Pola halaman

1. **Judul → subjudul konteks** (`page-title` + `page-subtitle`), mis. riwayat menegaskan "tidak dapat diubah atau dihapus".
2. **Filter dalam `.card`**, label terasosiasi, tombol Filter + "Atur ulang"; area muat mengumumkan lewat `aria-live` + skeleton.
3. **Tabel**: `overflow-x-auto`, baris `hover:bg-slate-50`, badge status, kolom bukti berupa `action-link`; `print:hidden` untuk elemen non-cetak di riwayat.
4. **Form**: `card-pad`, `fieldset`/`legend` untuk radio, `aria-describedby` untuk aturan bantu, pesan sukses/error ber-`role`.
5. **Notifikasi**: item belum dibaca = latar `indigo-50/50` + titik + badge "Baru" (bukan warna teks saja).
6. **Bahasa**: Indonesia untuk non-teknis — "Kata sandi", "Tingkat Keparahan", "Unduh CSV/PDF", "Atur ulang", `lang="id"`. Istilah domain (Pass/Fail/Bug) dipertahankan sesuai PRD.

## 4. Yang sengaja TIDAK dilakukan

Animasi berat, library baru, efek yang mengganggu pengisian form; skeleton hanya mengganti area yang sedang dimuat ulang, bukan seluruh halaman.
