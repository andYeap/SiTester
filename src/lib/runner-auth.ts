import { timingSafeEqual } from "node:crypto";

/** Autentikasi runner eksternal via header Authorization: Bearer <token>.
 * Token utama AI_RUNNER_TOKEN plus AI_RUNNER_TOKENS (koma, satu per host). */
/** Token utama AI_RUNNER_TOKEN plus daftar token per-runner AI_RUNNER_TOKENS
 * (dipisah koma) agar tiap host runner bisa memakai token sendiri. */
function expectedTokens(): Buffer[] {
  const raw = [
    process.env.AI_RUNNER_TOKEN ?? "",
    ...(process.env.AI_RUNNER_TOKENS ?? "").split(","),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
  return raw.map((s) => Buffer.from(s));
}

export function isRunnerAuthorized(request: Request): boolean {
  if (expectedTokens().length === 0) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  return expectedTokens().some(
    (expected) =>
      provided.length === expected.length &&
      timingSafeEqual(provided, expected),
  );
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
