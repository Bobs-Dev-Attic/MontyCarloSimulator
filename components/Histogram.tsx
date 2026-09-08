"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { SimulationResponse } from "@/lib/types";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useChartColors } from "@/lib/chartColors";

interface Props {
  data: SimulationResponse;
}

export default function Histogram({ data }: Props) {
  const { histogram, summary } = data;
  const c = useChartColors();
  const rows = histogram.counts.map((count, i) => {
    const lo = histogram.edges[i];
    const hi = histogram.edges[i + 1];
    return { center: (lo + hi) / 2, count, lo, hi };
  });

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="center"
            stroke={c.axis}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatCompact(v)}
            label={{
              value: "Terminal value",
              position: "insideBottom",
              offset: -2,
              fill: c.axis,
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={c.axis}
            tick={{ fontSize: 11 }}
            width={48}
            label={{
              value: "Paths",
              angle: -90,
              position: "insideLeft",
              fill: c.axis,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ fill: c.muted, fillOpacity: 0.08 }}
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: c.axis }}
            formatter={(value: number) => [`${value} paths`, "Count"]}
            labelFormatter={(v: number) => `≈ ${formatCurrency(v)}`}
          />
          <ReferenceLine
            x={summary.median}
            stroke={c.text}
            strokeWidth={1.5}
            label={{ value: "median", fill: c.text, fontSize: 10, position: "top" }}
          />
          <ReferenceLine
            x={summary.p5}
            stroke="#f87171"
            strokeDasharray="4 3"
            label={{ value: "p5", fill: "#f87171", fontSize: 10, position: "top" }}
          />
          <ReferenceLine
            x={summary.p95}
            stroke="#f87171"
            strokeDasharray="4 3"
            label={{ value: "p95", fill: "#f87171", fontSize: 10, position: "top" }}
          />
          <Bar dataKey="count" fill="#34d399" fillOpacity={0.85} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
