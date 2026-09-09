"use client";

import { useEffect, useRef, useState } from "react";
import { useBroadcast, type SharedKey } from "@/lib/broadcast";
import { usePreferences } from "@/lib/preferences";
import InfoTip from "@/components/InfoTip";

interface FieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Rendered display, e.g. "$10,000" or "7%". */
  display: string;
  hint?: string;
  /** When set, shows an "apply to all tabs" icon that broadcasts this value. */
  sharedKey?: SharedKey;
  /** Glossary key: shows an info tooltip with an explanation + source link. */
  info?: string;
}

export default function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  hint,
  sharedKey,
  info,
}: FieldProps) {
  const bc = useBroadcast();
  const prefs = usePreferences();
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  // A user-customized range (from Preferences) overrides the field's own.
  const override = sharedKey ? prefs?.rangeFor(sharedKey) : null;
  const effMin = override?.min ?? min;
  const effMax = override?.max ?? max;
  const effStep = override?.step ?? step;

  useEffect(() => {
    if (editing) editRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };
  const commitEdit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) {
      onChange(Math.min(effMax, Math.max(effMin, n)));
    }
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
          <label className="text-sm text-slate-200">{label}</label>
          {info ? <InfoTip term={info} /> : null}
        </span>
        <span className="flex items-center gap-1.5">
          {sharedKey && bc ? (
            <button
              type="button"
              onClick={() => {
                bc.applyAll(sharedKey, value);
                setFlash(true);
                setTimeout(() => setFlash(false), 900);
              }}
              title="Apply this value to all tabs"
              aria-label="Apply this value to all tabs"
              className={`grid h-5 w-5 place-items-center rounded border text-[11px] leading-none transition ${
                flash
                  ? "border-good bg-good/20 text-good"
                  : "border-line text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {flash ? "✓" : "⧉"}
            </button>
          ) : null}
          {editing ? (
            <input
              ref={editRef}
              type="number"
              inputMode="decimal"
              aria-label={`${label} exact value`}
              className="w-24 rounded border border-accent bg-panel2 px-1.5 py-0.5 text-right text-sm font-semibold tabular-nums text-accent outline-none"
              min={effMin}
              max={effMax}
              step={effStep}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                else if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="Click to type an exact value"
              aria-label={`${label}: ${display}. Click to type an exact value.`}
              className="rounded text-sm font-semibold tabular-nums text-accent underline decoration-dotted decoration-transparent underline-offset-2 transition hover:decoration-accent"
            >
              {display}
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        className="mt-2 w-full"
        min={effMin}
        max={effMax}
        step={effStep}
        value={value}
        aria-label={label}
        aria-valuetext={display}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}
