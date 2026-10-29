export type FeatureOption = {
  id: number;
  name: string;
  project: string | null;
  description: string | null;
};

export function projectNames(features: Pick<FeatureOption, "project">[]): string[] {
  const names = new Set<string>();
  for (const f of features) {
    if (f.project && f.project.trim() !== "") names.add(f.project);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "id"));
}

/** Cocokkan berdasar nama, deskripsi, ATAU proyek (case-insensitive). */
export function matchesQuery(f: Pick<FeatureOption, "name" | "project" | "description">, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (term === "") return true;
  return [f.name, f.description ?? "", f.project ?? ""].some((s) =>
    s.toLowerCase().includes(term),
  );
}

export function filterFeatures(
  features: FeatureOption[],
  query: string,
  project: string,
): FeatureOption[] {
  return features.filter(
    (f) =>
      (project === "" || (f.project ?? "") === project) && matchesQuery(f, query),
  );
}

export function groupByProject(features: FeatureOption[]): { project: string; items: FeatureOption[] }[] {
  const map = new Map<string, FeatureOption[]>();
  for (const f of features) {
    const key = f.project && f.project.trim() !== "" ? f.project : "Tanpa proyek";
    const list = map.get(key);
    if (list) list.push(f);
    else map.set(key, [f]);
  }
  const NONE = "Tanpa proyek";
  return [...map.entries()]
    .sort(([a], [b]) =>
      a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, "id"),
    )
    .map(([project, items]) => ({ project, items }));
}
