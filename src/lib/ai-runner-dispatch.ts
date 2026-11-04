const DEFAULT_REPO = "andYeap/SiTester";
const EVENT_TYPE = "ai-run";

/**
 * Picu workflow AI runner segera setelah run masuk antrean.
 * Tanpa token, biarkan fallback schedule/manual yang mengambil run.
 */
export async function dispatchAiRunner(runId: number): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "GITHUB_DISPATCH_TOKEN belum diset; AI runner mengandalkan schedule/manual.",
      );
    }
    return false;
  }

  const repo = process.env.GITHUB_REPO ?? DEFAULT_REPO;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: EVENT_TYPE,
        client_payload: { run_id: runId },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `Dispatch AI runner gagal (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      "Dispatch AI runner gagal:",
      e instanceof Error ? e.message : e,
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
