// globalSetup: siapkan database test TERPISAH (jalan di proses sendiri).
import { readFileSync } from "node:fs";
import { Pool } from "pg";

export default async function setup() {
  const admin = new Pool({
    host: process.env.TEST_PGHOST ?? "127.0.0.1",
    port: Number(process.env.TEST_PGPORT ?? 55432),
    user: process.env.TEST_PGUSER ?? "lensa",
    password: process.env.TEST_PGPASSWORD ?? "lensa",
    database: "postgres",
  });

  await admin.query(`CREATE DATABASE testlab_test`).catch((e: unknown) => {
    if (!(e instanceof Error) || !/already exists/.test(e.message)) throw e;
  });
  await admin.end();

  const url =
    process.env.TEST_DATABASE_URL ??
    "postgres://lensa:lensa@127.0.0.1:55432/testlab_test";
  const pool = new Pool({ connectionString: url });
  const schema = readFileSync("db/schema.sql", "utf8");
  await pool.query(schema);
  await pool.end();
}
