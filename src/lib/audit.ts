import { query } from "@/lib/db";

export function clientIp(request: Request): string | null {
  // Vercel menimpa x-real-ip dengan IP klien asli; utamakan itu.
  const real = request.headers.get("x-real-ip");
  if (real && real.trim() !== "") {
    return real.split(",")[0].trim().slice(0, 45) || null;
  }
  // x-forwarded-for bisa dipalsukan di entri AWAL oleh klien; proxy
  // tepercaya (Vercel) MENAMBAHKAN IP asli di entri TERAKHIR.
  const fwd = request.headers.get("x-forwarded-for");
  if (!fwd) return null;
  const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1].slice(0, 45) || null;
}

export async function audit(input: {
  actorId: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  target?: string | null;
  changes?: unknown;
  ip?: string | null;
}) {
  await query(
    `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, target, changes, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.actorId,
      input.actorName ?? null,
      input.actorRole ?? null,
      input.action,
      input.target ?? null,
      input.changes === undefined ? null : JSON.stringify(input.changes),
      input.ip ?? null,
    ],
  );
}
