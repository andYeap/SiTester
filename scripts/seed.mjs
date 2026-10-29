// Seed demo: 1 ketua + 3 tester (password: password), 10 fitur contoh.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

const scrypt = promisify(scryptCb);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false },
});

const passwordHash = await hashPassword("password");

await pool.query(
  `INSERT INTO users (name, email, password_hash, role) VALUES
     ('Ketua Tim','ketua@testlab.test',$1,'ketua_tim'),
     ('Tester Satu','tester1@testlab.test',$1,'tester'),
     ('Tester Dua','tester2@testlab.test',$1,'tester'),
     ('Tester Tiga','tester3@testlab.test',$1,'tester')
   ON CONFLICT (email) DO NOTHING`,
  [passwordHash],
);

const features = [
  ["Login Pengguna", "Alur masuk aplikasi", "Proyek Utama"],
  ["Registrasi Akun", "Pendaftaran akun baru", "Proyek Utama"],
  ["Reset Password", "Lupa password + captcha", "Proyek Utama"],
  ["Manajemen Profil", "Ubah nama, foto profil", "Proyek Utama"],
  ["Pencarian Produk", "Cari + filter", "Proyek Utama"],
  ["Keranjang Belanja", "Tambah/ubah/hapus item", "Proyek Utama"],
  ["Checkout Pembayaran", "Bayar QRIS/transfer", "Proyek Utama"],
  ["Riwayat Pesanan", "Daftar + detail pesanan", "Proyek Utama"],
  ["Notifikasi Email", "Email notifikasi status", "Proyek Utama"],
  ["Dashboard Admin", "Grafik + kelola data", "Proyek Utama"],
];

for (const [name, description, project] of features) {
  await pool.query(
    `INSERT INTO features (name, description, project_name, is_active, verified)
     VALUES ($1,$2,$3,true,true) ON CONFLICT DO NOTHING`,
    [name, description, project],
  );
}

const counts = await pool.query(
  `SELECT (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM features) AS features`,
);
console.log("seed OK:", counts.rows[0]);
await pool.end();
