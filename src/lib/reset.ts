import { createHash, randomBytes } from "node:crypto";

import { query, withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const TTL_HOURS = 24;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Buat token reset sekali pakai. Mengembalikan token mentah (hanya ini satu-satunya
 * kesempatan melihatnya); DB hanya menyimpan hash.
 */
export async function createResetToken(
  userId: string,
  ttlHours = TTL_HOURS,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await query(
    `UPDATE password_reset_tokens SET used_at=now()
      WHERE user_id=$1 AND used_at IS NULL`,
    [userId],
  );
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1,$2, now() + make_interval(hours => $3))`,
    [userId, hashToken(token), ttlHours],
  );

  return token;
}

export function resetUrl(origin: string, token: string): string {
  const base = (process.env.APP_URL || origin || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const passwordHash = await hashPassword(password);

  return withTransaction(async (client) => {
    const found = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [hashToken(token)],
    );
    if (found.rows.length === 0) return { ok: false } as const;

    const row = found.rows[0];
    await client.query(
      `UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2`,
      [passwordHash, row.user_id],
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at=now() WHERE id=$1`,
      [row.id],
    );
    // Reset password mencabut semua sesi lama.
    await client.query(`DELETE FROM sessions WHERE user_id=$1`, [row.user_id]);

    return { ok: true, userId: row.user_id } as const;
  });
}
