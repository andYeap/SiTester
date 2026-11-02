import { NextResponse } from "next/server";

import { queryOne } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { createResetToken, resetUrl } from "@/lib/reset";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 422 });
  }

  const user = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE email=$1`,
    [email],
  );

  let devResetUrl: string | undefined;
  if (user) {
    const token = await createResetToken(user.id);
    const url = resetUrl(new URL(request.url).origin, token);
    const sent = await sendMail({
      to: email,
      subject: "Reset password SITester",
      text: `Kami menerima permintaan reset password.\n\nBuka tautan berikut (berlaku 24 jam, satu kali pakai):\n${url}\n\nAbaikan email ini bila Anda tidak meminta reset.`,
    });
    // Di dev tanpa SMTP, tampilkan tautan agar alur tetap bisa dicoba.
    if (!sent && !mailConfigured() && process.env.NODE_ENV !== "production") {
      devResetUrl = url;
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "Jika email terdaftar, tautan reset password sudah dikirim. Periksa kotak masuk Anda.",
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}
