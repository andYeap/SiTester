/** Zona waktu tunggal aplikasi: Asia/Jakarta (pengguna di Indonesia). */
export const APP_TIME_ZONE = "Asia/Jakarta";

/** YYYY-MM-DD pada zona waktu aplikasi. Default: sekarang. */
export function todayString(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Tambah/kurang hari kalender sederhana pada string YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Label d/m untuk sumbu grafik dari tanggal ISO. */
export function dayMonthLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}
