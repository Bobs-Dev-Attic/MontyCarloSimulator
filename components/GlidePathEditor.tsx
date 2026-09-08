"use client";

import { useRef, useState } from "react";
import type { Waypoint } from "@/lib/glidepath";

interface Props {
  waypoints: Waypoint[];
  horizon: number;
  onChange: (wps: Waypoint[]) => void;
}

const W = 600;
const H = 260;
const L = 40;
const R = 14;
const T = 14;
const B = 30;
const PW = W - L - R;
const PH = H - T - B;

export default function GlidePathEditor({ waypoints, horizon, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const sorted = [...waypoints]
    .map((w, i) => ({ ...w, i }))
    .sort((a, b) => a.year - b.year);

  const xOf = (year: number) => L + (year / Math.max(1, horizon)) * PW;
  const yOf = (alloc: number) => T + (1 - alloc) * PH;

  const toData = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    const vy = ((clientY - rect.top) / rect.height) * H;
    const year = Math.max(0, Math.min(horizon, ((vx - L) / PW) * horizon));
    const alloc = Math.max(0, Math.min(1, 1 - (vy - T) / PH));
    return { year, alloc };
  };

  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return;
    const { year, alloc } = toData(e.clientX, e.clientY);
    const next = [...waypoints];
    const isFirst = drag === indexOfMinYear(waypoints);
    const isLast = drag === indexOfMaxYear(waypoints);
    next[drag] = {
      // Endpoints keep their year (0 and horizon); middle points move freely.
      year: isFirst ? 0 : isLast ? horizon : Number(year.toFixed(2)),
      alloc: Number(alloc.toFixed(3)),
    };
    onChange(next);
  };

  const addPoint = (e: React.PointerEvent) => {
    // Only when clicking empty plot area (circles stop propagation).
    const { year, alloc } = toData(e.clientX, e.clientY);
    const next = [...waypoints, { year: Number(year.toFixed(2)), alloc: Number(alloc.toFixed(3)) }];
    onChange(next);
    setSel(next.length - 1);
  };

  const removePoint = (idx: number) => {
    if (waypoints.length <= 2) return; // keep at least two
    onChange(waypoints.filter((_, i) => i !== idx));
    setSel(null);
  };

  const areaPath =
    `M ${xOf(sorted[0].year)} ${yOf(0)} ` +
    sorted.map((w) => `L ${xOf(w.year)} ${yOf(w.alloc)}`).join(" ") +
    ` L ${xOf(sorted[sorted.length - 1].year)} ${yOf(0)} Z`;
  const linePath =
    `M ` + sorted.map((w) => `${xOf(w.year)} ${yOf(w.alloc)}`).join(" L ");

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full touch-none select-none"
        style={{ height: 260 }}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        {/* horizontal gridlines: 0/25/50/75/100% */}
        {[0, 0.25, 0.5, 0.75, 1].map((a) => (
          <g key={a}>
            <line x1={L} y1={yOf(a)} x2={W - R} y2={yOf(a)} stroke="#1e2a44" strokeDasharray="3 3" />
            <text x={L - 6} y={yOf(a) + 3} textAnchor="end" fontSize="10" fill="#8ea1c0">
              {Math.round(a * 100)}%
            </text>
          </g>
        ))}
        {/* year ticks */}
        {yearTicks(horizon).map((yr) => (
          <text key={yr} x={xOf(yr)} y={H - 10} textAnchor="middle" fontSize="10" fill="#8ea1c0">
            {yr}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 0} textAnchor="middle" fontSize="10" fill="#8ea1c0">
          Years
        </text>

        {/* clickable background to add points */}
        <rect x={L} y={T} width={PW} height={PH} fill="transparent" onPointerDown={addPoint} style={{ cursor: "copy" }} />

        {/* risky-allocation area + line */}
        <path d={areaPath} fill="#f59e0b" fillOpacity={0.12} pointerEvents="none" />
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth={2} pointerEvents="none" />

        {/* draggable waypoints */}
        {sorted.map((w) => (
          <circle
            key={w.i}
            cx={xOf(w.year)}
            cy={yOf(w.alloc)}
            r={sel === w.i ? 8 : 6}
            fill={sel === w.i ? "#38bdf8" : "#f59e0b"}
            stroke="#0b1220"
            strokeWidth={2}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(w.i);
              setSel(w.i);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removePoint(w.i);
            }}
          />
        ))}
      </svg>

      <p className="mt-1 text-[11px] text-muted">
        Drag points to shape the risky-asset allocation over time. Click the chart to
        add a point; double-click a point to remove it. Line = % in the risky sleeve.
      </p>

      {/* Numeric editor (reliable fallback) */}
      <div className="mt-3 flex flex-wrap gap-2">
        {sorted.map((w) => (
          <span key={w.i} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${sel === w.i ? "border-accent2" : "border-line"}`}>
            <span className="text-muted">yr</span>
            <input
              type="number"
              value={Number(w.year.toFixed(1))}
              min={0}
              max={horizon}
              step={1}
              onChange={(e) => {
                const next = [...waypoints];
                next[w.i] = { ...next[w.i], year: Math.max(0, Math.min(horizon, parseFloat(e.target.value) || 0)) };
                onChange(next);
              }}
              className="w-12 rounded border border-line bg-panel2 px-1 py-0.5 text-right tabular-nums text-slate-100"
            />
            <input
              type="number"
              value={Math.round(w.alloc * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(e) => {
                const next = [...waypoints];
                next[w.i] = { ...next[w.i], alloc: Math.max(0, Math.min(1, (parseFloat(e.target.value) || 0) / 100)) };
                onChange(next);
              }}
              className="w-12 rounded border border-line bg-panel2 px-1 py-0.5 text-right tabular-nums text-slate-100"
            />
            <span className="text-muted">%</span>
            {waypoints.length > 2 ? (
              <button onClick={() => removePoint(w.i)} className="ml-0.5 text-muted hover:text-bad" title="Remove">✕</button>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function indexOfMinYear(wps: Waypoint[]): number {
  let idx = 0;
  for (let i = 1; i < wps.length; i++) if (wps[i].year < wps[idx].year) idx = i;
  return idx;
}
function indexOfMaxYear(wps: Waypoint[]): number {
  let idx = 0;
  for (let i = 1; i < wps.length; i++) if (wps[i].year > wps[idx].year) idx = i;
  return idx;
}
function yearTicks(horizon: number): number[] {
  const step = horizon <= 10 ? 2 : horizon <= 25 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= horizon; y += step) ticks.push(y);
  if (ticks[ticks.length - 1] !== horizon) ticks.push(horizon);
  return ticks;
}
