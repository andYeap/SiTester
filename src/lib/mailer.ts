import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null | undefined;

function mailer(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    cached = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cached;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const transport = mailer();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return true;
  } catch (error) {
    console.error("sendMail gagal", { subject: input.subject, error });
    return false;
  }
}

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error("sendTelegram gagal", { status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error("sendTelegram gagal", { error });
    return false;
  }
}

export function appLink(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}
