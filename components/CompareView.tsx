"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { HistoryEntry } from "@/lib/history";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import { useChartColors } from "@/lib/chartColors";

const COLOR_A = "#f59e0b";
const COLOR_B = "#38bdf8";

interface Props {
  a: HistoryEntry;
  b: HistoryEntry;
  onClose: () => void;
}

interface Row {
  key: string;
  label: string;
  a: number;
  b: number;
  kind: "currency" | "percent";
  /** For a "higher is better" metric, a positive delta (b−a) is good. */
  higherIsBetter: boolean;
}

function buildRows(a: HistoryEntry, b: HistoryEntry): Row[] {
  const rows: Row[] = [
    { key: "median", label: "Median outcome", a: a.summary.median, b: b.summary.median, kind: "currency", higherIsBetter: true },
    { key: "mean", label: "Mean outcome", a: a.summary.mean, b: b.summary.mean, kind: "currency", higherIsBetter: true },
    { key: "p5", label: "P5 (worst 5%)", a: a.summary.p5, b: b.summary.p5, kind: "currency", higherIsBetter: true },
    { key: "p95", label: "P95 (best 5%)", a: a.summary.p95, b: b.summary.p95, kind: "currency", higherIsBetter: true },
    { key: "var95", label: "95% VaR", a: a.summary.var95, b: b.summary.var95, kind: "currency", higherIsBetter: false },
  ];
  // Model-dependent headline metric.
  if (a.model === "retirement" || b.model === "retirement") {
    rows.push({
      key: "successRate",
      label: "Success rate",
      a: a.summary.successRate,
      b: b.summary.successRate,
      kind: "percent",
      higherIsBetter: true,
    });
  } else {
    rows.push({
      key: "probLoss",
      label: "Prob. of loss",
      a: a.summary.probLoss,
      b: b.summary.probLoss,
      kind: "percent",
      higherIsBetter: false,
    });
  }
  return rows;
}

export default function CompareView({ a, b, onClose }: Props) {
  const rows = buildRows(a, b);
  const c = useChartColors();

  // Merge the two median trajectories onto a shared x-axis.
  const xs = Array.from(
    new Set([...a.trajectory.steps, ...b.trajectory.steps])
  ).sort((x, y) => x - y);
  const at = (e: HistoryEntry, key: "p5" | "p50" | "p95", x: number) => {
    const i = e.trajectory.steps.indexOf(x);
    return i >= 0 ? e.trajectory[key][i] : null;
  };
  const chartRows = xs.map((x) => ({
    x,
    aBand: [at(a, "p5", x), at(a, "p95", x)] as [number | null, number | null],
    bBand: [at(b, "p5", x), at(b, "p95", x)] as [number | null, number | null],
    aMed: at(a, "p50", x),
    bMed: at(b, "p50", x),
  }));

  const fmt = (v: number, kind: "currency" | "percent") =>
    kind === "currency" ? formatCurrency(v) : formatPercent(v);

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Compare forecasts</h3>
        <button
          onClick={onClose}
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition hover:text-slate-200"
        >
          Close
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-line/60 p-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR_A }} />{" "}
          <span className="align-middle text-slate-200">A · {a.label}</span>
        </div>
        <div className="rounded-lg border border-line/60 p-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR_B }} />{" "}
          <span className="align-middle text-slate-200">B · {b.label}</span>
        </div>
      </div>

      {/* Stat comparison table */}
      <div className="mb-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">Metric</th>
              <th className="pb-2 text-right font-medium">A</th>
              <th className="pb-2 text-right font-medium">B</th>
              <th className="pb-2 text-right font-medium">Δ (B−A)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => {
              const delta = r.b - r.a;
              const good = r.higherIsBetter ? delta > 0 : delta < 0;
              const neutral = Math.abs(delta) < 1e-9;
              const tone = neutral ? "text-muted" : good ? "text-good" : "text-bad";
              const deltaStr =
                r.kind === "currency"
                  ? `${delta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))}`
                  : `${delta >= 0 ? "+" : "−"}${formatPercent(Math.abs(delta))}`;
              return (
                <tr key={r.key} className="border-t border-line/50">
                  <td className="py-1.5 text-slate-200">{r.label}</td>
                  <td className="py-1.5 text-right">{fmt(r.a, r.kind)}</td>
                  <td className="py-1.5 text-right">{fmt(r.b, r.kind)}</td>
                  <td className={`py-1.5 text-right font-medium ${tone}`}>
                    {neutral ? "—" : deltaStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Overlaid median trajectories (with faint p5–p95 bands) */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              stroke={c.axis}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}`}
              label={{ value: a.xAxisLabel, position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }}
            />
            <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
            <Tooltip
              contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: c.axis }}
              formatter={(value: number, name: string) =>
                name === "aMed" || name === "bMed"
                  ? [formatCompact(value), name === "aMed" ? "A median" : "B median"]
                  : [null, null]
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              payload={[
                { value: "A median", type: "line", color: COLOR_A, id: "a" },
                { value: "B median", type: "line", color: COLOR_B, id: "b" },
              ]}
            />
            <Area type="monotone" dataKey="aBand" stroke="none" fill={COLOR_A} fillOpacity={0.1} isAnimationActive={false} legendType="none" connectNulls />
            <Area type="monotone" dataKey="bBand" stroke="none" fill={COLOR_B} fillOpacity={0.1} isAnimationActive={false} legendType="none" connectNulls />
            <Line type="monotone" dataKey="aMed" stroke={COLOR_A} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" connectNulls />
            <Line type="monotone" dataKey="bMed" stroke={COLOR_B} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
