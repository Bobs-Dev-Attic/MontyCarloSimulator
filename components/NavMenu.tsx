"use client";

import { useEffect, useRef } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import NavIcon from "@/components/NavIcons";

export interface NavItem {
  id: string;
  label: string;
  hint?: string;
  /** One-line plain-language "what this view tells you", shown under the heading. */
  blurb?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
}

export default function NavMenu({ open, onOpenChange, items, active, onSelect }: Props) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      navRef.current
        ? Array.from(
            navRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
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
          <nav ref={navRef} className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
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
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    active === it.id ? "bg-accent text-ink" : "text-slate-200 hover:bg-panel2"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                      active === it.id ? "bg-ink/10 text-ink" : "bg-panel2 text-accent2"
                    }`}
                  >
                    <NavIcon id={it.id} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{it.label}</span>
                    {it.hint ? (
                      <span className={`text-[11px] ${active === it.id ? "text-ink/70" : "text-muted"}`}>{it.hint}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
              <span className="text-[11px] uppercase tracking-wide text-muted">Appearance</span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
