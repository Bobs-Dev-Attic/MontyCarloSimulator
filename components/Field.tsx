"use client";

import { useState } from "react";
import { useBroadcast, type SharedKey } from "@/lib/broadcast";
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
  const [flash, setFlash] = useState(false);

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
          <span className="text-sm font-semibold tabular-nums text-accent">
            {display}
          </span>
        </span>
      </div>
      <input
        type="range"
        className="mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}
