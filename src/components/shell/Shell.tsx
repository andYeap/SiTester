import Link from "next/link";

import type { SessionUser } from "@/lib/auth";
import { ShellNotifIcon, ShellSidebarNav, type ShellNavItem } from "./ShellNav";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", ketua: false },
  { href: "/pengujian-baru", label: "Pengujian Baru", ketua: false },
  { href: "/riwayat", label: "Riwayat", ketua: false },
  { href: "/fitur", label: "Fitur", ketua: false },
  { href: "/defect", label: "Defect", ketua: false },
  { href: "/proyek", label: "Proyek", ketua: true },
  { href: "/permohonan", label: "Permohonan", ketua: true },
  { href: "/pengguna", label: "Pengguna", ketua: true },
  { href: "/peran", label: "Peran Uji", ketua: true },
  { href: "/siklus", label: "Siklus", ketua: true },
  { href: "/impor", label: "Import", ketua: true },
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
  const items: ShellNavItem[] = LINKS.filter((link) => !link.ketua || isKetua).map(
    (link) => ({
      href: link.href,
      label: link.label,
      section: link.ketua ? "manajemen" : "utama",
    }),
  );

  async function logout() {
    "use server";
    const { destroySession } = await import("@/lib/auth");
    const { redirect } = await import("next/navigation");
    await destroySession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <input
        id="sidebar-toggle"
        type="checkbox"
        className="peer sr-only"
        aria-label="Buka atau tutup menu"
      />

      <label
        htmlFor="sidebar-toggle"
        aria-label="Tutup menu"
        className="fixed inset-0 z-40 hidden bg-neutral-950/50 peer-checked:block lg:hidden"
      />

      <aside
        aria-label="Sidebar aplikasi"
        className="fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r border-neutral-800 bg-neutral-950 text-white shadow-[8px_0_32px_-24px_rgba(0,0,0,0.8)] transition-transform duration-200 ease-out peer-checked:translate-x-0 lg:translate-x-0"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg font-black text-neutral-950"
            aria-hidden
          >
            S
          </span>
          <div className="leading-tight">
            <Link href="/dashboard" className="text-lg font-extrabold tracking-tight text-white">
              SITester
            </Link>
            <p className="text-[11px] text-neutral-400">Pencatatan Pengujian Tim</p>
          </div>
        </div>

        <ShellSidebarNav items={items} unread={unread} />

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="mb-3 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-neutral-400">{isKetua ? "Ketua Tim" : "Tester"}</p>
          </div>
          <form action={logout}>
            <button className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <label
              htmlFor="sidebar-toggle"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 lg:hidden"
              aria-label="Buka menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <span className="text-sm font-bold tracking-tight text-neutral-950 lg:hidden">
              SITester
            </span>
          </div>

          <ShellNotifIcon unread={unread} />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
