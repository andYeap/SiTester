import { NextResponse } from "next/server";

import { queryOne } from "@/lib/db";

export async function GET() {
  try {
    await queryOne(`SELECT 1 AS ok`);
    return NextResponse.json({
      status: "ok",
      db: "up",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("health check gagal", { error });
    return NextResponse.json(
      { status: "error", db: "down", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
