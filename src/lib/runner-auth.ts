import { timingSafeEqual } from "node:crypto";

/** Autentikasi runner eksternal via header Authorization: Bearer <AI_RUNNER_TOKEN>. */
export function isRunnerAuthorized(request: Request): boolean {
  const expected = process.env.AI_RUNNER_TOKEN;
  if (!expected || expected.length < 20) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function runnerUnauthorized() {
  return Response.json(
    { error: "Runner token tidak valid atau belum dikonfigurasi." },
    { status: 401 },
  );
}

export function runnerId(request: Request): string {
  return (
    request.headers.get("x-runner-id")?.slice(0, 100) || "runner"
  );
}
