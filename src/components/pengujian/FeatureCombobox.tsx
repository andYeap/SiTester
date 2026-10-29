"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { filterFeatures, groupByProject, type FeatureOption } from "@/lib/features";

type Props = {
  id: string;
  label: string;
  features: FeatureOption[];
  value: string;
  project: string;
  onChange: (featureId: string) => void;
};

export default function FeatureCombobox({ id, label, features, value, project, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(
    () => filterFeatures(features, query, project),
    [features, query, project],
  );
  const groups = useMemo(() => groupByProject(filtered), [filtered]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeRaw, setActiveRaw] = useState(0);
  const active = flat.length === 0 ? 0 : Math.min(activeRaw, flat.length - 1);
  function setActive(v: number | ((a: number) => number)) {
    setActiveRaw(typeof v === "function" ? (v as (p: number) => number)(activeRaw) : v);
  }
  const selected = features.find((f) => String(f.id) === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open ]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && flat[active]) {
      e.preventDefault();
      pick(String(flat[active].id));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && flat[active] ? `uji-fitur-opt-${flat[active].id}` : undefined}
          autoComplete="off"
          value={open ? query : (selected ? `${selected.name}${selected.project ? ` — ${selected.project}` : ""}` : "")}
          placeholder={open ? "Ketik untuk mencari..." : "— Pilih fitur —"}
          readOnly={!open}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="input pr-16"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {value !== "" && (
            <button
              type="button"
              aria-label="Bersihkan pilihan fitur"
              onClick={() => {
                onChange("");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-sm text-neutral-400 hover:text-neutral-900"
            >
              ✕
            </button>
          )}
          <span aria-hidden className="pointer-events-none text-sm text-neutral-400">▾</span>
        </div>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Hasil pencarian fitur"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-xl"
        >
          {groups.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">
              Tidak ada fitur yang cocok{project ? ` di proyek “${project}”` : ""}.
            </li>
          )}
          {groups.map((g) => (
            <li key={g.project}>
              <p className="sticky top-0 bg-neutral-50 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {g.project}
              </p>
              <ul>
                {g.items.map((f) => {
                  const idx = flat.indexOf(f);
                  const isActive = idx === active;
                  const isSelected = String(f.id) === value;
                  return (
                    <li
                      key={f.id}
                      id={`uji-fitur-opt-${f.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(String(f.id));
                      }}
                      onMouseEnter={() => setActive(idx)}
                      className={`cursor-pointer px-4 py-2 text-sm ${isActive ? "bg-neutral-950 text-white" : "text-neutral-900"}`}
                    >
                      <span className="font-medium">{f.name}</span>
                      {f.description && (
                        <span className={`block truncate text-xs ${isActive ? "text-neutral-300" : "text-neutral-500"}`}>
                          {f.description}
                        </span>
                      )}
                      {isSelected && <span aria-hidden className="float-right">✓</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
