import { Pool, type PoolClient } from "pg";

// Pool dibuat malas (lazy): modul boleh di-import saat build tanpa DATABASE_URL;
// pool baru dibuat pada query pertama, saat env sudah tersedia.
let cachedPool: Pool | undefined;

function getPool(): Pool {
  const globalForPg = globalThis as unknown as { __testlabPool?: Pool };
  if (globalForPg.__testlabPool) return globalForPg.__testlabPool;
  if (cachedPool) return cachedPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  cachedPool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPg.__testlabPool = cachedPool;
  }
  return cachedPool;
}

export async function query<T extends object>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends object>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Jalankan callback dalam satu transaksi; rollback otomatis bila gagal. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
