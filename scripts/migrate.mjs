import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(dir, "..", "db", "migrations");

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

await pool.query(
  `CREATE TABLE IF NOT EXISTS schema_migrations (
     name       text PRIMARY KEY,
     applied_at timestamptz NOT NULL DEFAULT now()
   )`,
);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let applied = 0;
for (const file of files) {
  const existing = await pool.query(
    `SELECT 1 FROM schema_migrations WHERE name=$1`,
    [file],
  );
  if (existing.rowCount) continue;

  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [
      file,
    ]);
    await client.query("COMMIT");
    applied += 1;
    console.log(`applied ${file}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const users = await pool.query("SELECT count(*)::int AS n FROM users");
const roles = await pool.query("SELECT count(*)::int AS n FROM testing_roles");
console.log(
  `migrate OK — ${applied} baru, users: ${users.rows[0].n}, roles: ${roles.rows[0].n}`,
);
await pool.end();
