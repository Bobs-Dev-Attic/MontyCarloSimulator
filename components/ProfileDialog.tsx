"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  collectSettings,
  downloadProfile,
  parseProfile,
  applyProfile,
  type ParsedProfile,
} from "@/lib/profile";
import { summarizeData, type CategorySummary } from "@/lib/profileCategories";

type Mode = "export" | "import";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8 MB — profiles are tiny; reject anything huge.

interface Props {
  mode: Mode;
  onClose: () => void;
}

function Checklist({
  items,
  selected,
  onToggle,
}: {
  items: CategorySummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
      {items.map((it) => (
        <label
          key={it.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-panel2 p-2.5 transition hover:brightness-110"
        >
          <input
            type="checkbox"
            checked={selected.has(it.id)}
            onChange={() => onToggle(it.id)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[color:rgb(var(--accent))]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-sm font-medium text-slate-100">{it.label}</span>
              {it.detail ? <span className="text-[11px] text-accent2">{it.detail}</span> : null}
            </span>
            {it.hint ? <span className="mt-0.5 block text-[11px] text-muted">{it.hint}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export default function ProfileDialog({ mode, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Export: summarize the current settings.
  const exportSummary = useMemo<CategorySummary[]>(
    () => (mode === "export" ? summarizeData(collectSettings()) : []),
    [mode]
  );

  // Import: file state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedProfile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const importSummary = useMemo<CategorySummary[]>(
    () => (parsed ? summarizeData(parsed.profile.data) : []),
    [parsed]
  );

  const items = mode === "export" ? exportSummary : importSummary;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("monty-carlo-profile");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Default-select every available category whenever the item list changes.
  useEffect(() => {
    setSelected(new Set(items.map((i) => i.id)));
  }, [items]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOn = items.length > 0 && items.every((i) => selected.has(i.id));
  const setAll = (on: boolean) => setSelected(on ? new Set(items.map((i) => i.id)) : new Set());

  const readFile = async (file: File) => {
    setErr(null);
    setParsed(null);
    setFileName(file.name);
    if (file.size > MAX_IMPORT_BYTES) {
      setErr("That file is unexpectedly large — refusing to read it.");
      return;
    }
    try {
      const text = await file.text();
      const result = parseProfile(text);
      setParsed(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const onExport = () => {
    downloadProfile([...selected], name);
    setDone("Exported your selected settings.");
    setTimeout(onClose, 900);
  };

  const onImport = () => {
    if (!parsed) return;
    try {
      const n = applyProfile(parsed.profile, [...selected]);
      setDone(`Imported ${n} setting${n === 1 ? "" : "s"} — reloading…`);
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not import those settings.");
    }
  };

  if (!mounted) return null;

  const title = mode === "export" ? "Export settings" : "Import settings";
  const canSubmit =
    selected.size > 0 && (mode === "export" ? items.length > 0 : Boolean(parsed));

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "import" && !parsed ? (
            <div>
              <p className="mb-3 text-sm text-slate-300">
                Choose a profile <span className="font-mono text-xs">.json</span> file. It&apos;s
                examined for a valid format and anything unexpected before you pick what to import.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                Choose file…
              </button>
              {fileName ? <p className="mt-2 text-[11px] text-muted">Selected: {fileName}</p> : null}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <>
              {mode === "export" ? (
                <p className="mb-3 text-sm text-slate-300">
                  Pick which settings to include in the exported file. Your simulation
                  history is included when checked below.
                </p>
              ) : (
                <div className="mb-3 rounded-xl border border-good/30 bg-good/5 p-3 text-xs text-slate-300">
                  <p className="font-semibold text-good">Examined: valid Monty Carlo profile.</p>
                  {parsed?.profile.exportedAt ? (
                    <p className="mt-0.5 text-muted">
                      Exported {new Date(parsed.profile.exportedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {parsed?.warnings.length ? (
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-accent">
                      {parsed.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-muted">
                    Choose which categories to import. Only the categories you pick are
                    replaced — the rest of your current settings are left alone.
                  </p>
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-sm text-muted">Nothing to {mode} here.</p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted">
                      {selected.size} of {items.length} selected
                    </span>
                    <button
                      onClick={() => setAll(!allOn)}
                      className="text-[11px] text-accent2 transition hover:underline"
                    >
                      {allOn ? "Select none" : "Select all"}
                    </button>
                  </div>
                  <Checklist items={items} selected={selected} onToggle={toggle} />
                </>
              )}

              {mode === "export" ? (
                <div className="mt-4">
                  <label className="block text-[11px] uppercase tracking-wide text-muted">File name</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none"
                    />
                    <span className="text-xs text-muted">-YYYY-MM-DD.json</span>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {err ? <p className="mt-3 text-xs text-bad">{err}</p> : null}
          {done ? <p className="mt-3 text-xs text-good">{done}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-slate-200">
            Cancel
          </button>
          {mode === "import" && parsed ? (
            <button
              onClick={() => {
                setParsed(null);
                setFileName(null);
                setErr(null);
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 transition hover:bg-panel2"
            >
              Choose another file
            </button>
          ) : null}
          {(mode === "export" || parsed) ? (
            <button
              onClick={mode === "export" ? onExport : onImport}
              disabled={!canSubmit}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === "export" ? "Export selected" : "Import selected"}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
