"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "@/lib/glossary";

interface Props {
  term: string;
  /** Optional label for screen readers if the glossary title isn't ideal. */
  ariaLabel?: string;
}

export default function InfoTip({ term, ariaLabel }: Props) {
  const entry = GLOSSARY[term];
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 260;
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 6, left });
    };
    place();
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", () => setOpen(false), true);
    window.addEventListener("resize", () => setOpen(false));
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", () => setOpen(false), true);
      window.removeEventListener("resize", () => setOpen(false));
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={ariaLabel ?? `About ${entry.title}`}
        title={entry.title}
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold leading-none transition ${
          open ? "border-accent2 text-accent2" : "border-line text-muted hover:border-accent2 hover:text-accent2"
        }`}
      >
        i
      </button>
      {mounted && open && pos
        ? createPortal(
            <div
              className="fixed z-[60] w-[260px] rounded-xl border border-line bg-panel2 p-3 text-left shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-semibold text-white">{entry.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{entry.body}</p>
              <a
                href={entry.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent2 hover:underline"
              >
                Learn more on {entry.source} ↗
              </a>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
