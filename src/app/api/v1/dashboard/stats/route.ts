import { NextResponse } from "next/server";

import { err, needUser } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { getDashboardStats, type StatsRange } from "@/lib/stats";

export async function GET(request: Request) {
  const user = await needUser();
  if (!user) return err("Unauthorized", 401);

  const sp = new URL(request.url).searchParams;
  const range: StatsRange = sp.get("range") === "7" ? 7 : 30;
  const cycle = sp.get("cycle")?.trim() || null;

  if (cycle) {
    const exists = await queryOne<{ name: string }>(
      `SELECT name FROM test_cycles WHERE name=$1`,
      [cycle],
    );
    if (!exists) return err("Siklus tidak valid.", 422);
  }

  const stats = await getDashboardStats(
    user.id,
    user.role === "ketua_tim",
    range,
    cycle,
  );
  return NextResponse.json(stats);
}
