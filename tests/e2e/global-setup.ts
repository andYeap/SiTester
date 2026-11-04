import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { Pool } from "pg";

// E2E memakai database terpisah agar tidak mengotori database dev.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://lensa:lensa@127.0.0.1:55432/testlab_e2e";

// Dijalankan dari root repo (cwd), jadi path relatif aman.
const root = process.cwd();

function adminConfig(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: "postgres",
  };
}

export default async function setup() {
  const dbName = new URL(E2E_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nama database E2E tidak valid: ${dbName}`);
  }

  const admin = new Pool(adminConfig(E2E_DATABASE_URL));
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } catch (e) {
    if (!(e instanceof Error) || !/already exists/.test(e.message)) throw e;
  } finally {
    await admin.end();
  }

  // Pakai migrasi berversi (sama seperti produksi), bukan snapshot schema,
  // agar urutan seed FK tetap benar.
  for (const script of ["scripts/migrate.mjs", "scripts/seed.mjs"]) {
    execFileSync("node", [join(root, script)], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      stdio: "inherit",
    });
  }

  // Fixture M8: satu permohonan kedaluwarsa milik tester1.
  const fx = new Pool({ connectionString: E2E_DATABASE_URL });
  try {
    const tester = await fx.query<{ id: string }>(
      `SELECT id FROM users WHERE email='tester1@testlab.test'`,
    );
    const feature = await fx.query<{ id: number }>(
      `SELECT id FROM features WHERE name='Login Pengguna'`,
    );
    if (tester.rows.length > 0 && feature.rows.length > 0) {
      await fx.query(
        `DELETE FROM retest_requests WHERE reason='e2e-fixture-expired'`,
      );
      await fx.query(
        `INSERT INTO retest_requests (user_id, feature_id, tested_as_role, status, reason, created_at, expires_at)
         VALUES ($1,$2,'tester','pending','e2e-fixture-expired', now() - interval '10 days', now() - interval '3 days')`,
        [tester.rows[0].id, feature.rows[0].id],
      );
    }
  } finally {
    await fx.end();
  }
}
