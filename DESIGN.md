# DESIGN.md — SITester

Sistem desain monokrom hitam/putih (redesign 29 Okt 2026, menggantikan dunia indigo/violet + status berwarna).

## 1. Token warna

| Token | Nilai | Pakai untuk |
|---|---|---|
| Tinta `--color-ink` | `#09090b` (neutral-950) | Semua aksi primer, judul, badge Pass/Baru, header, logo-block |
| Kertas | `#fafafa` body, `#ffffff` kartu | Latar aplikasi vs permukaan kartu |
| Netral | `neutral-100/200/300` garis & pembagi, `neutral-500/600` teks sekunder, `neutral-800/900` teks isi | Satu skala netral saja — tidak ada `slate-*`, `gray-*`, indigo, violet, emerald, rose, amber, sky |
| Status tanpa warna | Pass = `badge-pass` (hitam solid/teks putih) · Fail = `badge-fail` (putih/border-2 hitam) · Bug = `badge-bug` (putih/border dashed) · Info/netral = `badge-neutral`/`badge-outline` | Selalu pasangkan label teks (PASS/FAIL/BUG) + bentuk border berbeda, jangan mengandalkan warna |
| Grafik | Bar `#09090b`, pie `#09090b` / `#71717a` / `#d4d4d8` + border hitam | Urutan gelap→terang = Pass→Fail→Bug, legenda selalu tampil |
| Header | `bg-neutral-950` + `border-neutral-800`, teks putih | Satu-satunya permukaan gelap; badge unread putih/teks hitam |

Adegan cahaya: tester bekerja di ruangan terang — dasar terang, tinta hitam. Bukan dark-mode.

## 2. Kelas komponen bersama (`src/app/globals.css`)

| Kelas | Kapan memakai | Jangan untuk |
|---|---|---|
| `.card` / `.card-pad` | Semua panel: statistik, filter, form, tabel | Jangan rakit `rounded-2xl border … shadow` manual |
| `.page-title` / `.page-subtitle` | Setiap halaman: judul + satu baris konteks (`neutral-950` / `neutral-600`) | Sub-judul seksi pakai `font-semibold text-neutral-700` |
| `.btn-primary` / `.btn-dark` / `.btn-success-solid` | Satu aksi utama per halaman — semuanya hitam solid/teks putih (Masuk, Filter, Simpan, Setujui, Unduh CSV) | Jangan bedakan primer/sukses dengan warna |
| `.btn-soft` | Aksi sekunder netral (Unduh PDF, Tandai dibaca, paginasi) — putih/border `neutral-300` | Jangan untuk aksi utama |
| `.btn-danger-soft` | Hanya Tolak — putih/border-2 hitam, hover jadi hitam solid (inversi = sinyal destruktif tanpa merah) | Jangan untuk ekspor/cetak |
| `.icon-btn` | Tombol ikon bel (SVG garis 1.8, bukan emoji) — target ≥44px | Tautan teks |
| `.action-link` | Aksi teks di tabel — `neutral-950` + underline saat hover + fokus jelas; min 44px | Tombol utama |
| `.label` / `.hint` | Semua label form; `.hint` untuk aturan bantu | Label filter kecil boleh `label text-xs` |
| `.input` / `.input-file` | Semua kontrol; `accent-neutral-950` untuk radio/checkbox; file pakai tombol hitam | Jangan `rounded-md border-gray-300` mentah |
| `.table-head` / `.table-th` | Semua tabel (`bg-neutral-100`) + `caption.sr-only` | — |
| `.badge` + varian | `badge-pass` (isi hitam) / `badge-fail` (border-2) / `badge-bug` (border dashed) / `badge-neutral` / `badge-outline` | Jangan rakit `rounded px-2…` manual; jangan bedakan status hanya dengan warna |
| `.alert-ok/err/warn/info` | Umpan balik ber-border hitam: ok = hitam solid/teks putih; err = putih/border-2; warn/info = `neutral-100`/putih border tipis | Jangan `bg-yellow-50` / `bg-red-50` manual |
| `.empty-state` + `.empty-icon/title/hint` | Semua keadaan kosong + CTA; ikon = SVG garis dalam kotak `neutral-100` border, bukan emoji | Jangan teks polos "Belum ada data." |
| `.skeleton` | Pengganti area muat — kilau mati saat `prefers-reduced-motion` | Jangan spinner baru/lib baru |

Aturan tombol: semua `.btn-*` punya `min-h-11` (44px) dan `focus-visible:ring-neutral-950`; pil rentang 7/30 hari juga `min-h-11` + `aria-pressed`, aktif = hitam solid, nonaktif = putih border.

## 3. Pola halaman

1. **Judul → subjudul konteks** (`page-title` + `page-subtitle`).
2. **Filter dalam `.card`**, label terasosiasi, tombol Filter + "Atur ulang"; area muat mengumumkan lewat `aria-live` + skeleton.
3. **Tabel**: `overflow-x-auto`, baris `hover:bg-neutral-100`, badge status monokrom, kolom bukti berupa `action-link`; angka tanggal/jumlah pakai `tabular-nums`.
4. **Form**: `card-pad`, `fieldset`/`legend` untuk radio, `aria-describedby` untuk aturan bantu, pesan sukses/error ber-`role`; kartu "Ajukan Permohonan" = `border-2 border-neutral-950` (tanpa amber).
5. **Notifikasi**: belum dibaca = `bg-neutral-100` + titik hitam + badge `badge-pass` "Baru" (bukan warna teks saja).
6. **Bahasa**: Indonesia untuk non-teknis — "Kata sandi", "Tingkat Keparahan", "Unduh CSV/PDF", "Atur ulang", `lang="id"`. Istilah domain (Pass/Fail/Bug) dipertahankan sesuai PRD.
7. **Browser surfaces**: `::selection` hitam/putih, `focus-visible` hitam 2px, scrollbar/caret mengikuti tinta; tidak ada gradient-text, glass, atau hard offset shadow.

## 4. Yang sengaja TIDAK dilakukan

Warna aksen (indigo/violet/emerald/rose/amber/sky), gradien, badge berwarna, emoji sebagai ikon, kicker/eyebrow, animasi berat, library baru; skeleton hanya mengganti area yang sedang dimuat ulang, bukan seluruh halaman.
