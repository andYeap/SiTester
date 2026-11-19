export const MAX_SHOTS = 8;

/** Hanya path relatif di dalam direktori hasil yang boleh dibaca. */
export function isSafeShotPath(rel) {
  return (
    typeof rel === "string" &&
    rel !== "" &&
    !rel.startsWith("/") &&
    !rel.includes("..")
  );
}

const label = (step) => {
  const text = typeof step.label === "string" ? step.label.trim().slice(0, 80) : "";
  return text ? `${step.index + 1}. ${step.api} — ${text}` : `${step.index + 1}. ${step.api}`;
};

/** Screenshot per langkah agent, terurut dan tanpa duplikat. */
export function collectStepScreenshots(report) {
  const out = [];
  const seen = new Set();
  for (const result of report?.run?.results ?? []) {
    for (const attempt of result?.attempts ?? []) {
      const byId = new Map(
        (attempt?.artifacts ?? [])
          .filter((a) => a?.kind === "screenshot" && typeof a.path === "string")
          .map((a) => [a.id, a]),
      );
      const steps = [...(attempt?.steps ?? [])].sort((a, b) => a.index - b.index);
      for (const step of steps) {
        for (const id of step?.artifacts ?? []) {
          const artifact = byId.get(id);
          if (!artifact || seen.has(artifact.path)) continue;
          seen.add(artifact.path);
          out.push({ path: artifact.path, label: label(step) });
          if (out.length === MAX_SHOTS) return out;
        }
      }
    }
  }
  return out;
}
