# Galeri screenshot hasil AI Test — desain

Tanggal: 2026-11-17
Status: menunggu persetujuan

## Kenapa

Panel Log AI Test sekarang hanya menampilkan **satu** screenshot terakhir dan satu blok
teks `runner_log`. Pengguna tidak bisa melihat bukti visual bahwa agen benar-benar sampai
di keadaan yang diuji — misalnya sudah berada di dashboard setelah login.

Tujuannya: setelah run selesai, panel Log menampilkan **urutan screenshot** hasil
pengujian, masing-masing dengan label langkah, sehingga terlihat progres agen dan
keadaan akhir sebagai tanda berhasil.

## Batasan

- Runner berjalan di luar aplikasi (VPS / GitHub Actions). Tidak ada kanal live; semua
  gambar dikirim saat run selesai.
- `e2e` sudah menulis screenshot per langkah agent ke `.e2e/report.json`
  (`attempts[].steps[].artifacts` → `attempts[].artifacts[].path`), tetapi hanya pada
  langkah agent yang memakai vision.
- Bukti disimpan lewat `saveEvidence()` (terenkripsi, disajikan `/api/uploads` yang wajib
  login). Setiap gambar disimpan terpisah.
- Batas ukuran yang sudah berlaku: 2 MB per gambar, hanya PNG/JPEG/WebP/GIF.

## Pendekatan yang dipilih

**A — galeri dari report `e2e` (dipilih).** Runner mengumpulkan screenshot semua langkah
agent berurutan, menambah dua screenshot eksplisit (setelah login berhasil, setelah
tujuan tercapai), lalu mengunggahnya sebagai daftar. Server menyimpan daftar itu di satu
kolom JSON; UI menampilkannya sebagai galeri.

Ditolak: **B** (satu screenshot saja — tidak memperlihatkan progres) dan **C** (timeline
penuh dengan tabel langkah, waktu, dan penjelasan model — kerja UI jauh lebih besar untuk
nilai tambah tipis).

## Cara kerjanya

### Data

Migrasi baru `db/migrations/0013_ai_run_screenshot_gallery.sql`, dan `db/schema.sql`
disinkronkan:

```sql
ALTER TABLE ai_test_runs ADD COLUMN IF NOT EXISTS evidence_gallery jsonb;
```

Bentuknya array berurutan: `[{"path": "<path bukti>", "label": "<label langkah>"}]`.
`evidence_path` tetap diisi dengan gambar **terakhir** supaya kolom "Bukti" dan run lama
tidak berubah.

### Runner (`scripts/ai-runner.mjs`)

- `buildTest()` menambah `await app.screenshot("login-berhasil")` setelah langkah login
  (hanya jika `login.hasCredentials`) dan `await app.screenshot("tujuan-tercapai")`
  sebelum screenshot penutup.
- Fungsi baru menggantikan `findScreenshot()`: menelusuri `report.run.results[]` →
  `attempts[]` → `steps[]`, memetakan `steps[].artifacts` ke entri `attempts[].artifacts`
  ber-`kind: "screenshot"`, dan mengembalikan `[{ path, label }]` terurut
  (attempt → step → index artefak). Label: `<index+1>. <api> — <label>` dipotong ~120
  karakter.
- Bila report tidak memberi screenshot sama sekali, jatuh ke perilaku lama: cari file
  gambar di `.e2e/results` dan pakai satu gambar dengan label "hasil-ai".
- `uploadResult()` mengirim field `screenshots` (berulang) dan `screenshot_labels`
  (JSON array sejajar indeks). Maksimum 8 gambar per run; sisanya dibuang dengan catatan
  di log.

### Endpoint `POST /api/v1/ai-runs/[id]/result`

- Membaca `form.getAll("screenshots")` dan `screenshot_labels`; label yang tidak cocok
  jumlahnya diisi default `Langkah N`.
- Tiap file divalidasi lewat `saveEvidence()` (aturan ukuran/tipe yang sama). Gambar yang
  gagal disimpan dilewati, dan alasannya ditambahkan ke `notes` seperti perilaku
  `evidenceWarning` sekarang.
- `evidence_gallery` diisi array hasil; `evidence_path` diisi path gambar terakhir.
  Field `evidence` tunggal tetap diterima (kompatibilitas) dan diperlakukan sebagai
  galeri satu entri bila `screenshots` kosong.
- `GET /api/v1/ai-runs/[id]` mengembalikan `evidence_gallery` di objek `run`.

### UI (`src/components/ai-runs/AiRunsView.tsx`)

- `RunLog` mendapat `evidence_gallery: { path: string; label: string }[] | null`.
- Di panel Log: bila galeri berisi gambar, render `<figure>` berurutan — gambar
  (lebar penuh, maksimum 3xl) dengan `<figcaption>` berisi label. Bila kosong, tetap
  tampilkan `evidence_path` seperti sekarang, lalu teks "Screenshot tidak tersedia".
- Log teks (`<pre>`) tetap di bawah galeri, tidak berubah.

## Risiko

- Jumlah gambar bergantung pada apakah model memakai vision; run tanpa vision hanya
  menghasilkan screenshot eksplisit (login/tujuan/penutup). Ini diterima — minimal selalu
  ada satu bukti keadaan akhir.
- `saveEvidence` menulis satu file per gambar; 8 gambar × 2 MB masih di bawah batas body
  route handler (60 dtk `maxDuration`).
- Path artefak di report bersifat relatif terhadap `.e2e/results`; resolusi harus mencoba
  basis yang sama seperti `findScreenshot` sekarang agar tidak regresi.

## Rencana uji

- Vitest (`tests/api/ai-runs.test.ts`): unggah dua `screenshots` + dua label, lalu
  pastikan `evidence_gallery` berisi dua entri berurutan, `evidence_path` sama dengan
  path entri terakhir, dan label tersimpan.
- Vitest: unggah tanpa `screenshots` tetapi dengan `evidence` lama → galeri berisi satu
  entri (kompatibilitas).
- Manual: `npm run ai-runner:once` terhadap target yang bisa login, lalu buka panel Log
  dan pastikan urutan gambar masuk akal dan gambar terakhir menunjukkan keadaan berhasil.

## Yang diserahkan ke pelaksana

- Memilih batas jumlah gambar (default 8) bila terasa terlalu banyak/ sedikit.
- Detail pemotongan label dan penamaan file screenshot eksplisit.
- Apakah `has_shots` perlu ditambahkan ke query daftar run (tidak wajib; tombol Log sudah
  aktif berdasarkan `has_log`).
