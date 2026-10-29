# Design Pass — progres

- [x] Fase 1 — init PRODUCT.md
- [x] Fase 2 — evaluate (audit, maks 10 temuan)
- [x] Fase 3 — refine (rias)
- [x] Fase 4 — enhance (percantik, TAHANAN)
- [x] Fase 5 — document (DESIGN.md)
- [ ] Fase 5 — document (DESIGN.md)
- [ ] Verifikasi akhir: `npx tsc --noEmit` + `npm run lint` + `npm run build` hijau

## Fase 2 — temuan audit (maks 10)

1. **Label tidak terasosiasi (a11y)** — `src/app/login/page.tsx:55-74`, `src/components/pengujian/PengujianForm.tsx:166-261`, `src/components/history/RiwayatTable.tsx:100-137`, master managers. `<label>` tanpa `htmlFor`/`id`, pembaca layar & ketuk-label tidak jalan. Dampak: pengguna non-teknis mengandalkan klik label; SR kehilangan konteks.
2. **`lang="en"` di root layout** — `src/app/layout.tsx:23`. Seluruh UI Bahasa Indonesia tapi dideklarasikan Inggris. Dampak: screen reader mengucapkan teks Indonesia dengan fonetik Inggris.
3. **Target sentuh <44px di mobile** — `src/components/shell/Shell.tsx:62-66` (ikon bel `p-2`), `src/components/dashboard/DashboardView.tsx:116-117` (pil 7/30 hari `py-1 text-xs`), link aksi tabel (`Edit`/`Hapus` teks polos). Dampak: sulit diketuk di HP.
4. **Tombol ekspor PDF memakai gaya bahaya** — `src/components/history/RiwayatTable.tsx:147` (`btn-danger-soft` merah untuk aksi netral). Dampak: pengguna mengira ekspor itu tindakan merusak/berisiko.
5. **Status baca notifikasi hanya dari warna teks** — `src/components/notifikasi/NotifikasiView.tsx:54` (`text-gray-500` vs `text-gray-900`). Dampak: beda tak terlihat bagi low-vision/buta warna; tak ada penanda "Baru".
6. **Inkonsistensi kartu/form/tabel antar halaman** — `CycleManager.tsx:87` (`rounded-lg bg-white p-4 shadow-sm`) vs `.card-pad`; `RoleManager.tsx:83` (input `rounded-md border-gray-300` mentah) vs `.input`; `NotifikasiView.tsx:51` (`rounded-lg bg-white shadow-sm`) vs `.card`. Dampak: terasa seperti aplikasi beda-beda, kepercayaan turun.
7. **Hierarki tipografi campur aduk** — `DashboardView.tsx:73,112,132,154` (`font-semibold text-slate-700`), `PermohonanView.tsx:72` (`text-gray-700`), `RiwayatTable.tsx:100-137` (label filter `text-xs text-slate-500` vs `.label`), badge dirakit manual (`rounded px-2...`) bukan `.badge`. Dampak: mata sulit memindai; slate vs gray terlihat tidak disengaja.
8. **Tidak ada status muat saat filter dashboard/riwayat** — `DashboardView.tsx:32-51`, `RiwayatTable.tsx:43-63` (fetch lalu `setState`, tanpa indikator/disabled). Dampak: pengguna menekan Filter berkali-kali / mengira aplikasi macet.
9. **Empty state minim tanpa arahan** — `RiwayatTable.tsx:215` ("Belum ada data pengujian."), `DashboardView.tsx:171`, `PermohonanView.tsx:75,109`, `NotifikasiView.tsx:52`. Dampak: pengguna baru bingung langkah berikutnya (mulai dari mana).
10. **Copy campur Inggris + radio tanpa grup semantik** — `PengujianForm.tsx:170-179` (radio Ya/Tidak tanpa `fieldset`/`legend`), label `src/components/pengujian/PengujianForm.tsx:229` ("Severity (wajib bila Fail/Bug)"), `src/app/login/page.tsx:66` ("Password"), `UserManager.tsx:91` ("Password (min 8)"), warna bar chart `#3b82f6` (`DashboardView.tsx:126`) lepas dari token brand indigo/violet. Dampak: non-teknis tersendat istilah; grup radio tak terbaca SR; aksen chart tak konsisten dengan merek.
