import { NextResponse } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/auth";

export function err(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function needUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function needKetua(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role !== "ketua_tim") return null;
  return user;
}

export type { SessionUser };
