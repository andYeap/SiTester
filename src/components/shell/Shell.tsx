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

  async function logout() {
    "use server";
    const { destroySession } = await import("@/lib/auth");
    const { redirect } = await import("next/navigation");
    await destroySession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-gray-800">
              TestLab
            </Link>
            <div className="hidden gap-4 sm:flex">
              {LINKS.filter((l) => !l.ketua || isKetua).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/notifikasi"
              className="relative text-sm text-gray-600 hover:text-gray-900"
              title="Notifikasi"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white">
                  {unread}
                </span>
              )}
            </Link>
            <span className="text-sm text-gray-700">{user.name}</span>
            <form action={logout}>
              <button className="text-sm text-gray-500 hover:text-gray-800">
                Keluar
              </button>
            </form>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4 py-2 sm:hidden">
          {LINKS.filter((l) => !l.ketua || isKetua).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-sm text-gray-600"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/notifikasi" className="whitespace-nowrap text-sm text-gray-600">
            Notifikasi{unread > 0 ? ` (${unread})` : ""}
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
