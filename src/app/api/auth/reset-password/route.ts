import { NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/lib/reset";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
  } | null;

  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Token reset tidak valid." }, { status: 422 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter." },
      { status: 422 },
    );
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Tautan reset tidak valid atau sudah kedaluwarsa." },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true });
}
