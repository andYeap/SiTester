import { query } from "@/lib/db";
import { appLink, sendMail, sendTelegram } from "@/lib/mailer";

export async function notifyUser(
  userId: string,
  input: { type: string; title: string; body?: string | null; link?: string | null },
) {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, input.type, input.title, input.body ?? null, input.link ?? null],
  );

  // Kanal eksternal bersifat best-effort: gagal kirim tidak menggagalkan aksi utama.
  const user = await query<{ email: string }>(
    `SELECT email FROM users WHERE id=$1`,
    [userId],
  );
  const email = user[0]?.email;
  if (email) {
    const link = appLink(input.link);
    await sendMail({
      to: email,
      subject: `[SITester] ${input.title}`,
      text: [input.body ?? "", link ?? ""].filter(Boolean).join("\n\n"),
    }).catch(() => undefined);
  }
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

  if (role === "ketua_tim") {
    const link = appLink(input.link);
    await sendTelegram(
      ["[SITester]", input.title, input.body ?? "", link ?? ""]
        .filter(Boolean)
        .join("\n"),
    ).catch(() => undefined);
  }
}
