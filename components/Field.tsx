"use client";

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
}: FieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm text-slate-200">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-accent">
          {display}
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
