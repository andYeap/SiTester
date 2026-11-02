"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ShellNavItem = {
  href: string;
  label: string;
  section: "utama" | "manajemen";
};

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const linkActive = "bg-white font-semibold text-neutral-950 shadow-sm";
const linkIdle = "text-neutral-300 hover:bg-white/10 hover:text-white";

function SidebarLink({
  item,
  active,
  badge,
}: {
  item: ShellNavItem;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${linkBase} ${active ? linkActive : linkIdle}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          active ? "bg-neutral-950" : "bg-neutral-600 group-hover:bg-white"
        }`}
        aria-hidden
      />
      <span className="flex-1">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-neutral-950">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function ShellSidebarNav({
  items,
  unread,
}: {
  items: readonly ShellNavItem[];
  unread: number;
}) {
  const pathname = usePathname();
  const notifActive = isActive(pathname, "/notifikasi");

  const groups = [
    {
      key: "utama" as const,
      label: "Utama",
      entries: items.filter((item) => item.section === "utama"),
    },
    {
      key: "manajemen" as const,
      label: "Manajemen",
      entries: items.filter((item) => item.section === "manajemen"),
    },
  ].filter((group) => group.entries.length > 0);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
      {groups.map((group) => (
        <div key={group.key} className="pb-2">
          <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.entries.map((item) => (
              <SidebarLink
                key={`${group.key}-${item.href}`}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}

            {group.key === "utama" ? (
              <SidebarLink
                item={{ href: "/notifikasi", label: "Notifikasi", section: "utama" }}
                active={notifActive}
                badge={unread}
              />
            ) : null}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function ShellNotifIcon({ unread }: { unread: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, "/notifikasi");
  return (
    <Link
      href="/notifikasi"
      aria-current={active ? "page" : undefined}
      aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      className={`icon-btn ${
        active
          ? "bg-neutral-950 text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
      }`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-neutral-950 px-1 text-[11px] font-bold text-white shadow">
          {unread}
        </span>
      )}
    </Link>
  );
}
