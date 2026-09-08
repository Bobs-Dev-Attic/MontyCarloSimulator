"use client";

import { useEffect } from "react";

export interface NavItem {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
}

export default function NavMenu({ open, onOpenChange, items, active, onSelect }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        aria-label="Open menu"
        aria-expanded={open}
        title="Menu"
        className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-panel text-slate-200 transition hover:bg-panel2"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
          <nav className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-white">Monty Carlo</span>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close menu"
                className="rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    onSelect(it.id);
                    onOpenChange(false);
                  }}
                  className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left transition ${
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
          </nav>
        </div>
      ) : null}
    </>
  );
}
