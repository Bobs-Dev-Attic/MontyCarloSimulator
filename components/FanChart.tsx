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
import type { SimulationResponse } from "@/lib/types";
import { formatCompact } from "@/lib/format";

interface Props {
  data: SimulationResponse;
}

export default function FanChart({ data }: Props) {
  const { bands, samplePaths, xAxis } = data;

  // One row per step; ranges are encoded as [low, high] tuples for Area.
  const rows = bands.steps.map((x, i) => {
    const row: Record<string, number | number[]> = {
      x,
      band90: [bands.p5[i], bands.p95[i]],
      band50: [bands.p25[i], bands.p75[i]],
      p50: bands.p50[i],
    };
    // Attach a few sample paths (thin lines) if the step indices line up.
    samplePaths.slice(0, 25).forEach((sp, k) => {
      if (i < sp.values.length) row[`s${k}`] = sp.values[i];
    });
    return row;
  });

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            stroke="#8ea1c0"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}`}
            label={{
              value: xAxis.label,
              position: "insideBottom",
              offset: -2,
              fill: "#8ea1c0",
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="#8ea1c0"
            tick={{ fontSize: 11 }}
            width={64}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={{
              background: "#0e1626",
              border: "1px solid #1e2a44",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8ea1c0" }}
            formatter={(value: number | number[], name: string) => {
              if (name.startsWith("s")) return [null, null] as never;
              if (Array.isArray(value)) {
                return [
                  `${formatCompact(value[0])} – ${formatCompact(value[1])}`,
                  name === "band90" ? "p5–p95" : "p25–p75",
                ];
              }
              return [formatCompact(value), "Median (p50)"];
            }}
            labelFormatter={(v: number) => `${xAxis.label}: ${v % 1 === 0 ? v : v.toFixed(2)}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            payload={[
              { value: "p5–p95", type: "rect", color: "#f59e0b", id: "b90" },
              { value: "p25–p75", type: "rect", color: "#38bdf8", id: "b50" },
              { value: "Median", type: "line", color: "#e6edf7", id: "med" },
            ]}
          />

          {/* Sample trajectories (drawn faintly behind the bands). */}
          {samplePaths.slice(0, 25).map((_, k) => (
            <Line
              key={`s${k}`}
              type="monotone"
              dataKey={`s${k}`}
              stroke="#3b82f6"
              strokeOpacity={0.08}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}

          <Area
            type="monotone"
            dataKey="band90"
            stroke="none"
            fill="#f59e0b"
            fillOpacity={0.16}
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="band50"
            stroke="none"
            fill="#38bdf8"
            fillOpacity={0.2}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#e6edf7"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
