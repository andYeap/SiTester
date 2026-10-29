import { query } from "@/lib/db";

export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 45) || null;
  return null;
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
