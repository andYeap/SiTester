import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(dir, "..", "db", "schema.sql"), "utf8");

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

await pool.query(sql);

const users = await pool.query("SELECT count(*)::int AS n FROM users");
const roles = await pool.query("SELECT count(*)::int AS n FROM testing_roles");
console.log(`migrate OK — users: ${users.rows[0].n}, roles: ${roles.rows[0].n}`);
await pool.end();
