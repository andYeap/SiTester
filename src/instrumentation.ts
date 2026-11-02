export async function register() {
  console.info(
    JSON.stringify({
      level: "info",
      message: "SITester starting",
      env: process.env.NODE_ENV,
      at: new Date().toISOString(),
    }),
  );
}

/** Log error terstruktur untuk observability (dibaca Next di server). */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
) {
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: request?.path,
      method: request?.method,
      routerKind: context?.routerKind,
      routePath: context?.routePath,
      routeType: context?.routeType,
      at: new Date().toISOString(),
    }),
  );
}
