"use client";

import type { SimulationResponse } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";

function Card({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "accent";
  hint?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-good"
      : tone === "bad"
      ? "text-bad"
      : tone === "accent"
      ? "text-accent"
      : "text-white";
  return (
    <div className="rounded-xl border border-line bg-panel2 p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export default function StatCards({ data }: { data: SimulationResponse }) {
  const { summary, model } = data;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {model === "retirement" ? (
        <Card
          label="Success rate"
          value={formatPercent(summary.successRate)}
          tone={summary.successRate >= 0.8 ? "good" : summary.successRate >= 0.5 ? "accent" : "bad"}
          hint="Paths that didn't run out"
        />
      ) : (
        <Card
          label="Prob. of loss"
          value={formatPercent(summary.probLoss)}
          tone={summary.probLoss <= 0.25 ? "good" : summary.probLoss <= 0.5 ? "accent" : "bad"}
          hint="Ended below starting value"
        />
      )}
      <Card label="Median outcome" value={formatCurrency(summary.median)} tone="accent" />
      <Card label="Mean outcome" value={formatCurrency(summary.mean)} />
      <Card label="95% VaR" value={formatCurrency(summary.var95)} tone="bad" hint="Loss vs. start at p5" />
      <Card label="P5 (worst 5%)" value={formatCurrency(summary.p5)} />
      <Card label="P95 (best 5%)" value={formatCurrency(summary.p95)} />
      <Card label="Minimum" value={formatCurrency(summary.min)} />
      <Card label="Maximum" value={formatCurrency(summary.max)} />
    </div>
  );
}
