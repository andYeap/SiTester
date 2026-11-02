// Bersihkan data kedaluwarsa. Aman dijalankan berkala (cron).
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

const statements = [
  [`DELETE FROM sessions WHERE expires_at <= now()`, "sesi kedaluwarsa"],
  [
    `DELETE FROM password_reset_tokens
      WHERE expires_at <= now() OR used_at IS NOT NULL`,
    "token reset",
  ],
  [
    `DELETE FROM retest_requests WHERE status='pending' AND expires_at <= now()`,
    "permohonan kedaluwarsa",
  ],
  [
    `DELETE FROM retest_approvals
      WHERE used_at IS NULL AND expires_at IS NOT NULL AND expires_at <= now()`,
    "approval kedaluwarsa",
  ],
  [
    `DELETE FROM login_attempts WHERE created_at < now() - interval '30 days'`,
    "login_attempts lama",
  ],
  [
    `DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < now() - interval '90 days'`,
    "notifikasi lama",
  ],
];

for (const [sql, label] of statements) {
  const res = await pool.query(sql);
  console.log(`${label}: ${res.rowCount ?? 0} dihapus`);
}

await pool.end();
