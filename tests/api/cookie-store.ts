// Dipakai oleh mock next/headers di setup.ts — store global agar bisa
// diatur dari helper test.
export function cookieStore(): Map<string, string> {
  const g = globalThis as unknown as { __testCookies?: Map<string, string> };
  if (!g.__testCookies) g.__testCookies = new Map();
  return g.__testCookies;
}
