import { NextResponse } from "next/server";

import { isRunnerAuthorized, runnerUnauthorized } from "@/lib/runner-auth";

/** Preflight runner: validasi token tanpa mengklaim antrean. */
export async function GET(request: Request) {
  if (!isRunnerAuthorized(request)) return runnerUnauthorized();
  return new NextResponse(null, { status: 204 });
}
