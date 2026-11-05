# Panduan Penggunaan SITester

**Aplikasi:** SITester — Pencatatan Pengujian Tim  
**URL produksi:** https://sitester-one.vercel.app  
**Versi dokumen:** 1.2 · 4 November 2026
**Untuk:** Tester dan Ketua Tim

Dokumen ini menjelaskan cara memakai SITester sehari-hari: mencatat hasil uji,
mengelola retest, menangani defect, import data lama, memakai AI Test, sampai
membaca log ketika pengujian gagal. Detail teknis ada di `README.md` dan `PRD.md`.

---

## 1. Apa itu SITester?

SITester menggantikan pencatatan pengujian manual di Excel dengan satu alur:

**catat hasil → kendalikan retest → pantau kualitas → ekspor laporan**

Manfaat utama:

- Riwayat pengujian tersimpan rapi dan bisa difilter.
- Pengujian ulang fitur yang sudah Pass dikendalikan lewat persetujuan ketua.
- Hasil Fail/Bug otomatis membuat defect yang bisa dilacak sampai verified.
- Dashboard menampilkan kondisi pengujian dan tugas yang belum selesai.
- Data Excel lama bisa diimpor.
- AI Test dapat menjalankan pengujian otomatis terhadap website lain dan
  menghasilkan draft hasil untuk dikonfirmasi.

---

## 2. Peran dan Hak Akses

| Peran | Hak utama |
|---|---|
| **Tester** | Mencatat hasil uji, mengajukan retest, mengusulkan fitur, mengelola test case/defect yang ia buat, melihat data sendiri dan agregat tim |
| **Ketua Tim** | Semua hak tester + menyetujui/menolak retest, melihat semua data, mengelola master, memverifikasi fitur/defect, import, mengelola pengguna dan tautan reset |

Hanya **Ketua Tim** yang melihat menu **Manajemen**: Proyek, Permohonan,
Pengguna, Peran Uji, Siklus, Import, dan Aktivitas.

Akun memiliki **satu sesi aktif**. Jika login di perangkat lain, sesi lama
otomatis tidak berlaku.

---

## 3. Masuk, Lupa Password, dan Keluar

### 3.1 Login

1. Buka https://sitester-one.vercel.app
2. Masukkan **Email** dan **Kata sandi**.
3. (Opsional) centang **Ingat saya di perangkat ini**.
4. Klik **Masuk**.

Tanpa "Ingat saya", sesi berlaku **8 jam**. Dengan "Ingat saya", Anda tetap
masuk **30 hari** — jangan aktifkan di komputer bersama.

Jika kata sandi salah terlalu sering, login dibatasi sementara (rate limit) dan
Anda perlu menunggu 15 menit.

### 3.2 Lupa password

1. Klik **Lupa kata sandi?** di halaman login.
2. Masukkan email akun.
3. Jika akun terdaftar, tautan reset dikirim ke email.
4. Buka tautan, buat password baru.
5. Semua sesi lama otomatis dicabut; login ulang dengan password baru.

Tautan reset berlaku **24 jam** dan hanya bisa dipakai sekali.

### 3.3 Reset oleh ketua

Ketua dapat membuka **Pengguna → Reset** pada baris pengguna untuk mendapatkan
tautan reset sekali pakai (berlaku 24 jam), lalu menyalin dan mengirimkannya.
Cara ini berguna jika email belum dikonfigurasi.

### 3.4 Keluar

Klik **Keluar** di bagian bawah sidebar. Sesi di database dicabut, bukan hanya
cookie di browser.

---

## 4. Navigasi

### Menu Utama (semua peran)

| Menu | Fungsi |
|---|---|
| **Dashboard** | Ringkasan hasil uji, grafik, dan Tugas Saya |
| **Pengujian Baru** | Form pencatatan hasil uji |
| **Riwayat** | Cari, filter, sort, ekspor CSV/PDF |
| **Fitur** | Daftar fitur, usulan fitur, detail fitur/test case/defect |
| **Defect** | Daftar temuan Fail/Bug dan siklus hidupnya |
| **AI Test** | Antrean pengujian otomatis dan konfirmasi hasil |
| **Notifikasi** | Pemberitahuan retest, persetujuan, dan aktivitas terkait |

### Menu Manajemen (ketua)

| Menu | Fungsi |
|---|---|
| **Proyek** | Master proyek tempat fitur bernaung |
| **Permohonan** | Setujui/tolak permohonan retest |
| **Pengguna** | Kelola akun, peran, dan tautan reset |
| **Peran Uji** | Master peran yang dipakai saat pengujian |
| **Siklus** | Master siklus dan fitur yang termasuk lingkupnya |
| **Import** | Impor riwayat dari Excel/CSV |
| **Aktivitas** | Audit aktivitas pengguna |

Di layar kecil, sidebar dibuka lewat tombol menu di kiri atas.

---

## 5. Alur Kerja Harian Tester

### 5.1 Dashboard dan Tugas Saya

Dashboard menampilkan:

- kartu bulan ini: jumlah pengujian, Pass, Fail/Bug (data Anda sendiri; seluruh
  tim untuk ketua) dan **Fitur Belum Diuji** (belum diuji siapa pun),
- filter **Siklus** dan grafik harian 7/30 hari, donut hasil, serta 10 fitur
  paling sering diuji,
- untuk siklus yang dipilih: instruksi siklus dan progres cakupan "X dari Y
  fitur teruji",
- **Tugas Saya** (tiga kartu):
  - **Belum saya uji** — fitur yang belum pernah Anda uji (dalam lingkup siklus
    bila dipilih),
  - **Permohonan saya** — permohonan retest yang menunggu (ada penanda
    "Kedaluwarsa") dan jumlah persetujuan yang siap dipakai,
  - **Defect terbuka** — defect berstatus open/reopened/fixed milik tim,
- khusus ketua: banner bila ada permohonan retest yang menunggu persetujuan.

Klik nama fitur pada **Belum saya uji** untuk membuka form dengan fitur dan
siklus yang sudah terisi.

### 5.2 Mencatat Pengujian Baru

Buka **Pengujian Baru**, lalu isi:

1. **Tanggal Pengujian** — tanggal hasil uji (tidak boleh di masa depan).
2. **Apakah ini pengujian ulang?**
   - **Tidak** untuk pengujian biasa.
   - **Ya** jika menguji ulang fitur/peran/siklus yang sudah punya hasil.
3. **Diuji sebagai peran** — peran yang dipakai saat menguji.
4. **Siklus** — opsional; jika dipilih, instruksi siklus tampil dan daftar fitur
   mengikuti lingkup siklus.
5. **Filter proyek** dan **Fitur yang Diuji** — ketik untuk mencari; daftar
   dikelompokkan per proyek.
6. **Test case** — opsional, muncul jika fitur punya test case.
7. **Status Hasil** — Pass, Fail, atau Bug. Sistem langsung memeriksa apakah
   fitur boleh diuji dan menampilkan peringatannya.
8. Jika hasil **Fail/Bug**, pilih **Tingkat Keparahan** (wajib) dan isi
   **Catatan** minimal 10 karakter.
9. Bagian **Detail opsional** (lipat) berisi lingkungan, yang diharapkan, yang
   terjadi, bukti gambar (maks 2MB), dan tautan bukti.
10. Klik **Simpan Hasil Pengujian**.

Setelah simpan, tanggal, pilihan pengujian ulang, peran, dan siklus tetap
terisi, sedangkan fitur/hasil/catatan dan detail lain direset agar mudah
mencatat hasil berikutnya.

**Draft otomatis:** isian disimpan di browser (per akun). Jika form dibuka
kembali, muncul pilihan **Pulihkan** atau **Hapus**.

**Mode cepat:** aktifkan saklar **Mode cepat** di kanan atas form, tambahkan
beberapa hasil ke daftar (**Tambah ke daftar**), lalu klik **Simpan semua**.
Setiap baris membawa tanggal, peran, dan siklus saat ditambahkan. Baris yang
gagal tetap berada di daftar beserta pesan kesalahannya. Mode cepat tidak
menyediakan test case dan detail opsional.

Bila Anda salah klik dua kali atau jaringan terputus saat menyimpan, hasil tidak
akan tercatat ganda.

### 5.3 Aturan Retest

Ruang lingkup retest adalah kombinasi **fitur + peran + siklus**.

- Jika fitur belum pernah diuji, pengujian langsung boleh.
- Jika hasil terakhir **Fail/Bug**, pengujian perbaikan boleh dilakukan lagi
  tanpa persetujuan.
- Jika hasil terakhir **Pass**, pengujian ulang memerlukan persetujuan ketua.
- Persetujuan retest berlaku **sekali pakai** dan memiliki masa berlaku hingga
  7 hari. Permohonan yang tidak diproses juga kedaluwarsa setelah 7 hari.
- Satu permohonan/persetujuan hanya berlaku untuk kombinasi fitur + peran +
  siklus yang diajukan; persetujuan untuk siklus A tidak berlaku di siklus B,
  dan "tanpa siklus" dianggap terpisah dari semua siklus.
- Permohonan hanya bisa diajukan untuk fitur yang hasil terakhirnya Pass.

Jika retest belum disetujui, form menampilkan peringatan dan tombol untuk
mengajukan permohonan. Setelah ketua menyetujui, buka kembali form dan pilih
**Pengujian Ulang = Ya**.

### 5.4 Riwayat

Menu **Riwayat** mendukung:

- pencarian (catatan/fitur/tester) dan filter tanggal, fitur, hasil, serta
  siklus,
- menu **Urutkan**: tanggal, fitur, hasil, atau severity (naik/turun),
- tombol preset **7 hari** dan **30 hari**,
- **Simpan filter** / **Hapus tersimpan** (disimpan di perangkat ini),
- tampilan kartu di layar kecil dan 50 baris per halaman,
- ekspor **CSV** dan **PDF** sesuai filter yang aktif.

Tester hanya melihat riwayat miliknya; ketua melihat riwayat seluruh tim.
Riwayat tidak dapat diubah atau dihapus.

PDF memuat seluruh hasil terfilter, bukan hanya halaman yang sedang terlihat.
Batas ekspor adalah 5.000 baris per file.

### 5.5 Fitur, Test Case, dan Detail Fitur

Halaman **Fitur** menampilkan daftar fitur dan statusnya.

- Tester dapat menambahkan usulan fitur. Usulan berstatus **Usulan baru** dan
  belum bisa dipakai untuk pengujian sampai ketua memverifikasinya.
- Ketua memverifikasi, mengedit, dan mengaktifkan/menonaktifkan fitur. Fitur
  yang sudah punya riwayat tidak bisa dihapus; nonaktifkan saja.
- Buka detail fitur untuk melihat:
  - test case,
  - defect terkait,
  - timeline semua sesi pengujian.

Test case berisi judul, langkah, expected result, dan status aktif. Siapa pun
yang login dapat menambah test case pada sebuah fitur; mengubah atau
menghapusnya hanya bisa dilakukan pembuatnya atau ketua.

### 5.6 Defect

Hasil **Fail** atau **Bug** otomatis membuat satu defect berstatus **open**.

Alur status:

```
open → fixed → verified → closed
                 ↑
             reopened
```

- **fixed**: perbaikan sudah dilakukan.
- **verified**: perbaikan sudah diverifikasi; hanya ketua yang dapat melakukan.
- **closed**: defect selesai.
- **reopened**: masalah muncul lagi.

Semua pengguna dapat melihat semua defect, tetapi **status hanya dapat diubah
oleh pembuat defect atau ketua**. Perpindahan status dibatasi sesuai alur di
atas (misalnya tidak bisa langsung dari open ke closed). Halaman ini mencatat
siapa yang memverifikasi.

Filter defect berdasarkan status dan fitur.

### 5.7 Notifikasi

Notifikasi muncul lewat ikon lonceng dan menu **Notifikasi**.

Notifikasi yang dikirim:

- permohonan retest baru → semua ketua,
- retest disetujui atau ditolak (beserta alasan) → tester pemohon.

Perubahan status defect dan import **tidak** mengirim notifikasi.

Jika dikonfigurasi administrator, notifikasi juga dikirim lewat email (ke
penerima) dan Telegram (khusus ketua). Notifikasi in-app tetap menjadi sumber
utama; Anda dapat menandai satu atau semua notifikasi sebagai dibaca.

---

## 6. AI Test

AI Test menjalankan pengujian otomatis terhadap **website target** memakai
browser Chromium di runner eksternal. Hasilnya berupa **draft** yang harus Anda
konfirmasi.

### 6.1 Membuat AI Test

Buka **AI Test**, lalu isi:

1. **URL target** — alamat halaman yang diuji.
2. **Tujuan pengujian** — instruksi bahasa natural, misalnya
   “buka menu Riwayat dan pastikan tabel riwayat tampil”.
3. **Kriteria berhasil** — patokan Pass/Fail.
4. **Fitur di SITester**, **Peran uji**, dan **Siklus** (opsional).

Tips: buat tujuan dan kriteria sesingkat mungkin. Semakin banyak langkah,
semakin lama dan semakin besar kemungkinan agent timeout.

### 6.2 Login ke website target

Jika website target memerlukan login, centang **“Perlu login ke target”**.

Isi:

- **URL login** — opsional; kosongkan jika login ada di URL target.
- **Email target** dan **password target** — opsional; jika kosong, runner
  memakai kredensial fallback yang dikonfigurasi administrator.
- **Instruksi login** — dipakai jika login diserahkan ke AI.
- **Label field email**, **Label field password**, **Label tombol login**.

Jika ketiga label diisi (contoh: `Email`, `Kata sandi`, `Masuk`), runner
melakukan **login deterministik** dengan locator. Cara ini lebih cepat dan
stabil daripada menyerahkan login ke AI.

Jika label dikosongkan, agent AI akan mencari field login sendiri. Cara ini
lebih fleksibel tetapi lebih lambat, bisa timeout, dan **password target akan
dikirim ke provider model AI**. Isi ketiga label agar login deterministik
tanpa melibatkan model.

Keamanan kredensial:

- kredensial disimpan terenkripsi di database,
- kredensial dihapus setelah hasil run dikirim,
- nilai kredensial di log disamarkan (`[redacted]`) — tetapi jangan mengetik
  password di kolom tujuan/instruksi.

### 6.3 Antrean dan status

Status run:

| Status | Arti |
|---|---|
| `queued` | Menunggu runner |
| `running` | Sedang dijalankan |
| `completed` | Runner selesai; lihat hasil Pass/Fail/Bug dan klik Konfirmasi |
| `error` | Run gagal karena infrastruktur/provider model/target diblokir — bukan verdict aplikasi; tidak bisa dikonfirmasi, baca Log lalu antrekan ulang |
| `confirmed` | Hasil sudah dikonfirmasi dan tersimpan sebagai pengujian (kolom Aksi menampilkan "Tersimpan") |

Maksimal **3 run aktif** (queued/running) per pengguna. Tester hanya melihat run
milik sendiri; ketua melihat semua.

Jika trigger otomatis GitHub Actions aktif, run baru langsung memicu workflow.
Jika tidak, run menunggu jadwal atau dijalankan manual oleh operator.

Halaman AI Test otomatis refresh selama ada run aktif.

### 6.4 Hasil dan konfirmasi

Setelah selesai:

1. Lihat hasil **PASS/FAIL**.
2. Klik **Log** untuk melihat penyebab detail jika gagal.
3. Klik **Konfirmasi** untuk membuka form pengujian dengan data terisi.
4. Periksa dan lengkapi hasil, lalu simpan.

Hasil AI **tidak otomatis** menjadi catatan resmi. Aturan retest dan persetujuan
ketua tetap berlaku saat konfirmasi.

### 6.5 Membaca log

Klik **Log** pada baris run. Log berisi:

- target dan model yang dipakai,
- langkah login/selector,
- output e2e dan error model,
- report pengujian.

Log menyamarkan nilai kredensial (`[redacted]`), tetapi jangan mengetik
password di kolom tujuan/instruksi. Tombol Log hanya muncul untuk run yang
memiliki log; run lama sebelum fitur log aktif tidak memiliki log.

Penyebab umum kegagalan AI:

| Pesan | Arti | Tindakan |
|---|---|---|
| `MODEL_PROVIDER_FAILED ... high demand` | Model gratis sedang sibuk | Tunggu dan ulangi, atau ganti model |
| `TEST_TIMEOUT` / `ACTION_FAILED` | Agent terlalu lama atau macet | Sederhanakan tujuan, ganti model, atau gunakan login deterministik |
| Selector `getByLabel` gagal | Label field login tidak cocok | Perbaiki label/URL login, lihat log |
| Login berhasil tetapi tujuan gagal | Masalah ada di langkah pengujian, bukan login | Periksa halaman target dan kriteria |
| `BLOB_READ_WRITE_TOKEN` | Storage bukti belum diset | Hubungi administrator; hasil tetap tersimpan |

### 6.6 Bukti screenshot

Screenshot disimpan ke Vercel Blob jika `BLOB_READ_WRITE_TOKEN` dikonfigurasi.
Tanpa token, hasil tetap disimpan tetapi screenshot dilewati dan muncul catatan
sistem.

Bukti disajikan lewat aplikasi dan hanya bisa dilihat pengguna yang sudah login.
Jika Blob store administrator belum mendukung akses privat, file memakai URL
acak (UUID) yang tidak ditemukan lewat pencarian tetapi tetap bisa dibuka siapa
pun yang memiliki tautannya — hindari data sensitif pada screenshot. Administrator
dapat mewajibkan mode privat dengan `BLOB_REQUIRE_PRIVATE=1` + Blob store privat.

### 6.7 Batasan AI Test

- Bukan pengganti keputusan tester; hasil wajib dikonfirmasi.
- MFA, CAPTCHA, SSO, dan login non-standar sering tidak bisa diotomasi.
- Model gratis memiliki rate limit dan bisa berubah-ubah.
- Browser berjalan di runner eksternal, bukan di Vercel.
- Gunakan akun tester khusus dengan hak minimal; jangan memakai akun admin
  produksi.
- Jangan menguji situs yang bukan milik/tidak Anda punya izin.
- Target internal (localhost/intranet) hanya bisa diuji runner yang
  mengizinkannya; metadata cloud selalu ditolak. Setiap request browser,
  termasuk redirect dan navigasi agen, diperiksa ulang.

---

## 7. Panduan Ketua Tim

### 7.1 Proyek

Buat dan kelola proyek. Fitur dihubungkan ke proyek; proyek yang masih dipakai
tidak bisa dihapus.

### 7.2 Pengguna

Ketua dapat:

- menambah pengguna (kata sandi awal minimal 8 karakter),
- melihat daftar pengguna dan jumlah pengujiannya,
- mengubah peran tester/ketua (tidak bisa menurunkan diri sendiri),
- membuat tautan reset password sekali pakai (tombol **Reset**),
- menghapus pengguna yang belum punya riwayat (akun sendiri tidak bisa dihapus).

### 7.3 Peran Uji

Kelola master peran yang muncul di form pengujian. Peran nonaktif tidak muncul
untuk pengujian baru, tetapi data lama tetap tersimpan.

### 7.4 Siklus

Buat siklus pengujian dan tentukan fitur yang termasuk di dalamnya.

- Jika siklus memiliki daftar fitur, form hanya menampilkan fitur dalam lingkup.
- Retest dan Tugas Saya mengikuti kombinasi fitur + peran + siklus.

### 7.5 Permohonan Retest

Buka **Permohonan** untuk melihat permintaan yang menunggu.

- **Setujui** dengan catatan opsional, atau
- **Tolak** dengan alasan (wajib diisi; alasan dikirim ke tester lewat notifikasi).

Permohonan yang kedaluwarsa (7 hari) tidak bisa lagi disetujui atau ditolak;
tester perlu mengajukan ulang. Halaman ini juga menampilkan 20 keputusan terakhir.

Setelah disetujui, tester dapat melakukan retest sekali. Gunakan kebijakan yang
konsisten agar riwayat tetap bermakna.

### 7.6 Import Excel/CSV

Buka **Import** dan ikuti langkah:

1. Unduh template **CSV** atau **XLSX**.
2. Pilih file `.xlsx` atau `.csv` (maks **2MB**, **5.000 baris**).
3. Pilih **sheet** dan baris header.
4. Periksa mapping kolom otomatis; ubah manual jika perlu.
5. Lihat pratinjau; baris invalid ditandai.
6. Pilih apakah error dilewati atau seluruh import dibatalkan.
7. Commit import.
8. Unduh **error CSV** jika ada baris yang gagal.

Kolom yang didukung:

`Tanggal`, `Email Tester`, `Fitur`, `Hasil`, `Peran`, `Siklus`, `Test Case`,
`Severity`, `Lingkungan`, `Diharapkan`, `Terjadi`, `Catatan`, `Bukti URL`,
`Ulang`.

Catatan:

- Baris duplikat (hash sama) otomatis dilewati.
- Import yang sama tidak menggandakan data.
- Fail/Bug membuat defect dengan pembuat = tester pada baris tersebut.
- Import tidak mengirim notifikasi.
- Riwayat batch tersedia untuk audit.

### 7.7 Aktivitas

Halaman **Aktivitas** menampilkan audit perubahan penting: master (fitur,
proyek, peran uji, siklus, pengguna, test case), pembuatan tautan reset,
perubahan status defect, dan import. Login dan keputusan approval tidak
dicatat di sini (keputusan approval terlihat di halaman **Permohonan**).
Gunakan pencarian dan filter aksi untuk menyaring.

---

## 8. Tips dan Praktik Baik

1. **Satu hasil = satu sesi.** Jangan menggabungkan beberapa fitur dalam satu
   catatan.
2. **Isi catatan yang bisa ditindaklanjuti.** Untuk Fail/Bug, tulis langkah
   reproduksi, expected, dan actual.
3. **Lampirkan bukti** untuk temuan yang perlu diperiksa orang lain.
4. **Jangan retest tanpa alasan.** Retest fitur Pass harus melalui approval.
5. **Gunakan siklus** agar cakupan pengujian jelas.
6. **Untuk AI Test, mulai dari tujuan sederhana.** Jika sudah stabil, baru
   tambah langkah.
7. **Gunakan login deterministik** (label field) agar tidak bergantung pada AI.
8. **Baca Log sebelum menyimpulkan aplikasi error.** Banyak kegagalan AI berasal
   dari model sibuk, selector, atau timeout.
9. **Gunakan akun tester khusus** untuk website target, bukan akun produksi.
10. **Ekspor cadangan** riwayat secara berkala jika diperlukan.

---

## 9. Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Tidak bisa login | Password salah / sesi lain aktif / rate limit | Tunggu, reset password, login ulang |
| “Fitur sudah Pass, perlu persetujuan” | Retest fitur yang sudah Pass | Ajukan retest, minta ketua menyetujui |
| Form retest tidak bisa disimpan | Approval belum ada/kedaluwarsa | Cek Permohonan; ajukan ulang |
| Upload bukti gagal | Token Blob belum diset / file bukan gambar / >2MB | Hubungi admin; gunakan PNG/JPEG/WebP/GIF ≤2MB |
| Import gagal | File >2MB, >5.000 baris, atau baris invalid | Pecah file, perbaiki error CSV |
| AI Test lama `queued` | Runner tidak aktif / dispatch token belum diset | Cek Log/Actions; operator jalankan workflow |
| AI Test FAIL `high demand` | Model gratis sedang sibuk | Ulangi atau ganti model |
| AI Test langsung `error` target diblokir | Target metadata cloud/IP privat | Untuk target internal, operator set `AI_RUNNER_ALLOW_PRIVATE_TARGETS=1` di runner |
| AI Test timeout | Tujuan terlalu kompleks / model lambat | Sederhanakan goal, pakai login deterministik |
| Tombol Log tidak ada | Run lama sebelum fitur log / log kosong | Gunakan log GitHub Actions untuk run lama |
| Screenshot tidak muncul | Blob belum dikonfigurasi | Set `BLOB_READ_WRITE_TOKEN`, redeploy |
| PDF/CSV kosong | Filter tidak cocok | Longgarkan filter/tanggal |
| Halaman lambat | Neon cold start / region berbeda | Coba lagi; hubungi admin |

---

## 10. Batasan Produk

- Hasil AI adalah draft, bukan keputusan final.
- PDF/CSV dibatasi 5.000 baris per ekspor.
- Import dibatasi 2MB / 5.000 baris agar commit tidak timeout (60 detik).
- Satu akun hanya boleh memiliki satu sesi aktif.
- Bukti gambar dibatasi 2MB per file.
- AI Test tidak menjamin bisa menangani MFA/CAPTCHA/SSO.
- Bukti disajikan lewat aplikasi (wajib login), tetapi bila Blob store tidak
  privat, file tetap memakai URL acak yang bisa dibuka siapa pun yang punya
  tautannya; hindari data sensitif.
- Aplikasi memakai zona waktu Asia/Jakarta untuk tanggal pengujian.

---

## 11. Referensi Internal

- `README.md` — setup, deployment, konfigurasi environment, AI runner.
- `PRD.md` — spesifikasi fitur, aturan bisnis, desain antarmuka, dan status implementasi.

Untuk masalah teknis (runner, database, token, deployment), hubungi administrator
aplikasi.
