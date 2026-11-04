const PREFIX = "sitester:draft-v3";
const LEGACY_KEY = "sitester:draft-v3";

export function draftKeyFor(userId?: string | null): string {
  const uid = typeof userId === "string" && userId.trim() !== "" ? userId.trim() : "anon";
  return `${PREFIX}:${uid}`;
}

export function clearDraftFor(userId?: string | null): void {
  try {
    localStorage.removeItem(draftKeyFor(userId));
  } catch {
    /* abaikan: storage tidak tersedia */
  }
}

export function clearAllDrafts(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k === LEGACY_KEY || (k !== null && k.startsWith(`${PREFIX}:`))) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {
    /* abaikan */
  }
}
