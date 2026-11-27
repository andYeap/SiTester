"use client";

import { useEffect } from "react";

/**
 * Menutup drawer mobile dengan Esc dan menjaga fokus tetap di dalamnya.
 * Checkbox tetap menjadi sumber status agar Shell tidak perlu menjadi
 * komponen klien.
 */
export default function SidebarController() {
  useEffect(() => {
    const toggle = document.getElementById("sidebar-toggle") as HTMLInputElement | null;
    const aside = document.getElementById("sidebar") as HTMLElement | null;
    const openLabel = document.querySelector<HTMLElement>(
      'label[for="sidebar-toggle"][aria-label="Buka menu"]',
    );
    if (!toggle || !aside || !openLabel) return;
    const toggleEl = toggle;
    const asideEl = aside;
    const openLabelEl = openLabel;

    const mobile = window.matchMedia("(max-width: 1023px)");
    const focusables = () =>
      Array.from(
        asideEl.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    let wasOpen = toggleEl.checked;

    function syncExpanded() {
      openLabelEl.setAttribute("aria-expanded", String(toggleEl.checked && mobile.matches));
    }

    function onMediaChange() {
      if (!mobile.matches) {
        toggleEl.checked = false;
        wasOpen = false;
      }
      syncExpanded();
    }

    function open() {
      if (!mobile.matches) return;
      requestAnimationFrame(() => focusables()[0]?.focus());
      syncExpanded();
    }

    function close() {
      if (!toggleEl.checked) return;
      toggleEl.checked = false;
      toggleEl.dispatchEvent(new Event("change", { bubbles: true }));
      openLabelEl.focus();
      syncExpanded();
    }

    function onChange() {
      if (toggleEl.checked) open();
      else {
        syncExpanded();
        if (mobile.matches && wasOpen) openLabelEl.focus();
      }
      wasOpen = toggleEl.checked;
    }

    function onLabelKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggleEl.checked = !toggleEl.checked;
      toggleEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!mobile.matches || !toggleEl.checked) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !asideEl.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !asideEl.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    toggleEl.addEventListener("change", onChange);
    openLabelEl.addEventListener("keydown", onLabelKeyDown);
    document.addEventListener("keydown", onKeyDown);
    mobile.addEventListener("change", onMediaChange);
    syncExpanded();

    return () => {
      toggleEl.removeEventListener("change", onChange);
      openLabelEl.removeEventListener("keydown", onLabelKeyDown);
      document.removeEventListener("keydown", onKeyDown);
      mobile.removeEventListener("change", onMediaChange);
    };
  }, []);

  return null;
}
