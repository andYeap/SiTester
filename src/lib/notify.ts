import { query } from "@/lib/db";

export async function notifyUser(
  userId: string,
  input: { type: string; title: string; body?: string | null; link?: string | null },
) {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, input.type, input.title, input.body ?? null, input.link ?? null],
  );
}

export async function notifyRole(
  role: "tester" | "ketua_tim",
  input: { type: string; title: string; body?: string | null; link?: string | null },
) {
  const users = await query<{ id: string }>(
    `SELECT id FROM users WHERE role = $1`,
    [role],
  );
  for (const u of users) {
    await notifyUser(u.id, input);
  }
}
