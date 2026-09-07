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

interface Props {
  data: SimulationResponse;
}

export default function Histogram({ data }: Props) {
  const { histogram, summary } = data;
  const rows = histogram.counts.map((count, i) => {
    const lo = histogram.edges[i];
    const hi = histogram.edges[i + 1];
    return { center: (lo + hi) / 2, count, lo, hi };
  });

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="center"
            stroke="#8ea1c0"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatCompact(v)}
            label={{
              value: "Terminal value",
              position: "insideBottom",
              offset: -2,
              fill: "#8ea1c0",
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="#8ea1c0"
            tick={{ fontSize: 11 }}
            width={48}
            label={{
              value: "Paths",
              angle: -90,
              position: "insideLeft",
              fill: "#8ea1c0",
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ fill: "#ffffff08" }}
            contentStyle={{
              background: "#0e1626",
              border: "1px solid #1e2a44",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8ea1c0" }}
            formatter={(value: number) => [`${value} paths`, "Count"]}
            labelFormatter={(v: number) => `≈ ${formatCurrency(v)}`}
          />
          <ReferenceLine
            x={summary.median}
            stroke="#e6edf7"
            strokeWidth={1.5}
            label={{ value: "median", fill: "#e6edf7", fontSize: 10, position: "top" }}
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
