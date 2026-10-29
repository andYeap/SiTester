import Link from "next/link";

import type { SessionUser } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", ketua: false },
  { href: "/pengujian-baru", label: "Pengujian Baru", ketua: false },
  { href: "/riwayat", label: "Riwayat", ketua: false },
  { href: "/fitur", label: "Fitur", ketua: false },
  { href: "/permohonan", label: "Permohonan", ketua: true },
  { href: "/pengguna", label: "Pengguna", ketua: true },
  { href: "/peran", label: "Peran Uji", ketua: true },
  { href: "/siklus", label: "Siklus", ketua: true },
  { href: "/aktivitas", label: "Aktivitas", ketua: true },
] as const;

export default function Shell({
  user,
  unread,
  children,
}: {
  user: SessionUser;
  unread: number;
  children: React.ReactNode;
}) {
  const isKetua = user.role === "ketua_tim";
  const items = LINKS.filter((l) => !l.ketua || isKetua);

  async function logout() {
    "use server";
    const { destroySession } = await import("@/lib/auth");
    const { redirect } = await import("next/navigation");
    await destroySession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 shadow-lg shadow-indigo-950/20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-lg font-black text-white shadow-md shadow-indigo-950/40">
                S
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">
                SITester
              </span>
            </Link>
            <nav className="hidden gap-1 md:flex" aria-label="Navigasi utama">
              {items.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-100/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/notifikasi"
              className="icon-btn text-indigo-100/80 hover:bg-white/10 hover:text-white"
              aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
            >
              <span aria-hidden>🔔</span>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow">
                  {unread}
                </span>
              )}
            </Link>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-indigo-200/70">
                {isKetua ? "Ketua Tim" : "Tester"}
              </div>
            </div>
            <form action={logout}>
              <button className="inline-flex min-h-11 items-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                Keluar
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden" aria-label="Navigasi utama">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-100/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/notifikasi"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-100/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Notifikasi{unread > 0 ? ` (${unread})` : ""}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
