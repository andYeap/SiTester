"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ShellNavItem = {
  href: string;
  label: string;
};

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const desktopBase =
  "rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const desktopActive = "bg-white font-semibold text-neutral-950";
const desktopIdle = "text-neutral-300 hover:bg-white/10 hover:text-white";

const mobileBase =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const mobileActive = "bg-white font-semibold text-neutral-950";
const mobileIdle = "text-neutral-300 hover:bg-white/10 hover:text-white";

export function ShellDesktopNav({
  items,
}: {
  items: readonly ShellNavItem[];
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 md:flex" aria-label="Navigasi utama">
      {items.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`${desktopBase} ${active ? desktopActive : desktopIdle}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ShellMobileNav({
  items,
  unread,
}: {
  items: readonly ShellNavItem[];
  unread: number;
}) {
  const pathname = usePathname();
  const notifActive = isActive(pathname, "/notifikasi");
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden"
      aria-label="Navigasi utama"
    >
      {items.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`${mobileBase} ${active ? mobileActive : mobileIdle}`}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/notifikasi"
        aria-current={notifActive ? "page" : undefined}
        className={`${mobileBase} ${notifActive ? mobileActive : mobileIdle}`}
      >
        Notifikasi{unread > 0 ? ` (${unread})` : ""}
      </Link>
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
      className={`icon-btn ${active ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-neutral-950 shadow">
          {unread}
        </span>
      )}
    </Link>
  );
}
