"use client";

import { useReal } from "@/lib/realContext";

/** Header control: switch outputs between nominal and real (today's $). */
export default function RealToggle() {
  const { real, inflation, setReal, setInflation } = useReal();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setReal(!real)}
        role="switch"
        aria-checked={real}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
          real ? "border-good bg-good/15 text-good" : "border-line bg-panel text-muted hover:text-slate-200"
        }`}
        title="Show outcomes in today's dollars (inflation-adjusted)"
      >
        <span className={`inline-block h-2 w-2 rounded-full ${real ? "bg-good" : "bg-muted"}`} />
        {real ? "Real (today's $)" : "Nominal $"}
      </button>
      {real ? (
        <label className="inline-flex items-center gap-1 text-[11px] text-muted">
          inflation
          <input
            type="number"
            step={0.25}
            value={Number((inflation * 100).toFixed(2))}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setInflation(Number.isFinite(v) ? Math.max(0, v / 100) : 0);
            }}
            className="w-14 rounded border border-line bg-panel2 px-1.5 py-0.5 text-right tabular-nums text-slate-100 focus:border-accent focus:outline-none"
          />
          %
        </label>
      ) : null}
    </div>
  );
}

/** Inline badge shown on results when the real view is active. */
export function RealBadge() {
  const { real, inflation } = useReal();
  if (!real) return null;
  return (
    <span className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
      today&apos;s $ · {(inflation * 100).toFixed(1)}% infl.
    </span>
  );
}
