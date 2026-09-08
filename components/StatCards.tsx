"use client";

import type { SimulationResponse } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import InfoTip from "@/components/InfoTip";

function Card({
  label,
  value,
  tone = "default",
  hint,
  info,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "accent";
  hint?: string;
  info?: string;
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
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
        {label}
        {info ? <InfoTip term={info} /> : null}
      </div>
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
          info="successRate"
        />
      ) : (
        <Card
          label="Prob. of loss"
          value={formatPercent(summary.probLoss)}
          tone={summary.probLoss <= 0.25 ? "good" : summary.probLoss <= 0.5 ? "accent" : "bad"}
          hint="Ended below starting value"
          info="probLoss"
        />
      )}
      <Card label="Median outcome" value={formatCurrency(summary.median)} tone="accent" info="median" />
      <Card label="Mean outcome" value={formatCurrency(summary.mean)} info="mean" />
      <Card label="95% VaR" value={formatCurrency(summary.var95)} tone="bad" hint="Loss vs. start at p5" info="var95" />
      <Card label="P5 (worst 5%)" value={formatCurrency(summary.p5)} info="percentile" />
      <Card label="P95 (best 5%)" value={formatCurrency(summary.p95)} info="percentile" />
      <Card label="Minimum" value={formatCurrency(summary.min)} />
      <Card label="Maximum" value={formatCurrency(summary.max)} />
    </div>
  );
}
