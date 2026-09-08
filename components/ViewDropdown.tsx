"use client";

import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/components/NavMenu";

interface Props {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
}

export default function ViewDropdown({ items, active, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.id === active);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-white transition hover:bg-panel2"
      >
        {current?.label ?? "Select view"}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="M3 4.5 6 8l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 max-h-[70vh] w-72 max-w-[85vw] overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-2xl"
        >
          {items.map((it) => (
            <button
              key={it.id}
              role="option"
              aria-selected={active === it.id}
              onClick={() => {
                onSelect(it.id);
                setOpen(false);
              }}
              className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition ${
                active === it.id ? "bg-accent text-ink" : "text-slate-200 hover:bg-panel2"
              }`}
            >
              <span className="text-sm font-medium">{it.label}</span>
              {it.hint ? (
                <span className={`text-[11px] ${active === it.id ? "text-ink/70" : "text-muted"}`}>{it.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
