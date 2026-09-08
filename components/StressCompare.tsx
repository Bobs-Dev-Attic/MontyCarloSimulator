"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import Field from "@/components/Field";
import { RealBadge } from "@/components/RealToggle";
import { useReal } from "@/lib/realContext";
import { usePersistentState } from "@/lib/persist";
import { useApplyAllHandler } from "@/lib/broadcast";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { StressCompareResponse, StressScenarioResult } from "@/lib/run";

const PALETTE = ["#34d399", "#f59e0b", "#f87171", "#38bdf8", "#a78bfa", "#fb923c", "#e879f9"];

export default function StressCompare() {
  const [beginningValue, setBeginningValue] = usePersistentState("stress.beginningValue", 100_000);
  const [mu, setMu] = usePersistentState("stress.mu", 0.07);
  const [sigma, setSigma] = usePersistentState("stress.sigma", 0.15);
  const [years, setYears] = usePersistentState("stress.years", 20);
  const [nSims, setNSims] = usePersistentState("stress.nSims", 6000);

  const [data, setData] = useState<StressCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { real, inflation } = useReal();

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setBeginningValue(value);
      else if (key === "mu") setMu(value);
      else if (key === "sigma") setSigma(value);
      else if (key === "years") setYears(value);
      else if (key === "nSims") setNSims(value);
    }, [setBeginningValue, setMu, setSigma, setYears, setNSims])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate/stress-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beginningValue, mu, sigma, years, nSims, seed: 2026 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      setData(json as StressCompareResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [beginningValue, mu, sigma, years, nSims]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deflate a terminal currency value / a per-year curve value when "real" is on.
  const tf = real ? Math.pow(1 + inflation, data?.years ?? 0) : 1;
  const dfV = (v: number) => v / tf;
  const dfAt = (v: number, x: number) => (real ? v / Math.pow(1 + inflation, x) : v);

  // Rows: baseline + scenarios, sorted worst→best by median.
  const rows = useMemo(() => {
    if (!data) return [];
    const all = [data.baseline, ...data.scenarios];
    return [...all].sort((a, b) => a.summary.median - b.summary.median);
  }, [data]);

  const baseMedian = data?.baseline.summary.median ?? 0;

  // Median-drop bar chart (scenarios only, worst first).
  const dropRows = useMemo(() => {
    if (!data) return [];
    return data.scenarios
      .map((s) => ({
        name: s.name,
        drop: baseMedian > 0 ? 1 - s.summary.median / baseMedian : 0,
      }))
      .sort((a, b) => b.drop - a.drop);
  }, [data, baseMedian]);

  // Overlaid median trajectories.
  const trajRows = useMemo(() => {
    if (!data) return [];
    const series = [data.baseline, ...data.scenarios];
    const xs = data.baseline.medianCurve.map((p) => p.x);
    return xs.map((x, i) => {
      const row: Record<string, number> = { x };
      series.forEach((s) => {
        const pt = s.medianCurve[i];
        if (pt) row[s.id] = dfAt(pt.p50, pt.x);
      });
      return row;
    });
  }, [data, real, inflation]);

  const seriesList: StressScenarioResult[] = data ? [data.baseline, ...data.scenarios] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Portfolio</h3>
        <div className="space-y-4">
          <Field label="Beginning value" info="beginningValue" value={beginningValue} onChange={setBeginningValue} min={1000} max={5_000_000} step={1000} display={formatCurrency(beginningValue)} sharedKey="beginningValue" />
          <Field label="Expected return (μ)" info="mu" value={mu} onChange={setMu} min={-0.05} max={0.2} step={0.005} display={formatPercent(mu)} sharedKey="mu" />
          <Field label="Base volatility (σ)" info="sigma" value={sigma} onChange={setSigma} min={0.01} max={0.6} step={0.005} display={formatPercent(sigma)} sharedKey="sigma" />
          <Field label="Time horizon" info="years" value={years} onChange={(v) => setYears(Math.round(v))} min={1} max={40} step={1} display={`${years} yr`} sharedKey="years" />
          <Field label="Simulations (per scenario)" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={20_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />
        </div>
        <button onClick={run} disabled={loading} className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Running all scenarios…" : "Run stress comparison"}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          Runs the baseline plus every macro scenario against the same portfolio,
          on a shared random seed, so differences reflect the scenario — not luck.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            {/* Ranked table */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                Scenario comparison <RealBadge />
                <span className="text-xs font-normal text-muted">worst → best, {data.nSims.toLocaleString()} sims each</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Scenario</th>
                      <th className="pb-2 text-right font-medium">Median</th>
                      <th className="pb-2 text-right font-medium">vs base</th>
                      <th className="pb-2 text-right font-medium">P5</th>
                      <th className="pb-2 text-right font-medium">Prob. loss</th>
                      <th className="pb-2 text-right font-medium">95% VaR</th>
                      <th className="pb-2 text-right font-medium">Paths hit</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rows.map((r) => {
                      const drop = baseMedian > 0 ? 1 - r.summary.median / baseMedian : 0;
                      return (
                        <tr key={r.id} className={`border-t border-line/50 ${r.isBaseline ? "bg-panel2/60" : ""}`}>
                          <td className="py-1.5 text-slate-200">
                            {r.isBaseline ? "● " : ""}{r.name}
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(dfV(r.summary.median))}</td>
                          <td className={`py-1.5 text-right ${drop > 0.001 ? "text-bad" : "text-muted"}`}>
                            {r.isBaseline ? "—" : `−${formatPercent(drop)}`}
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(dfV(r.summary.p5))}</td>
                          <td className="py-1.5 text-right">{formatPercent(r.summary.probLoss)}</td>
                          <td className="py-1.5 text-right">{formatCurrency(dfV(r.summary.var95))}</td>
                          <td className="py-1.5 text-right text-muted">{r.isBaseline ? "—" : formatPercent(r.fracWithShock)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Median drop bar chart */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Median impact vs baseline</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dropRows} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="#8ea1c0" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `−${Math.round(v * 100)}%`} />
                    <YAxis type="category" dataKey="name" stroke="#8ea1c0" tick={{ fontSize: 11 }} width={150} />
                    <Tooltip
                      cursor={{ fill: "#ffffff08" }}
                      contentStyle={{ background: "#0e1626", border: "1px solid #1e2a44", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`−${formatPercent(v)}`, "Median drop"]}
                    />
                    <Bar dataKey="drop" isAnimationActive={false} radius={2}>
                      {dropRows.map((_, i) => (
                        <Cell key={i} fill="#f87171" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overlaid median trajectories */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                Median trajectory by scenario <RealBadge />
              </h3>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
                    <XAxis dataKey="x" stroke="#8ea1c0" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}`} label={{ value: "Years", position: "insideBottom", offset: -2, fill: "#8ea1c0", fontSize: 11 }} />
                    <YAxis stroke="#8ea1c0" tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ background: "#0e1626", border: "1px solid #1e2a44", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v: number) => `Year ${Math.round(v)}`}
                      formatter={(value: number, key: string) => {
                        const s = seriesList.find((x) => x.id === key);
                        return [formatCompact(value), s?.name ?? key];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} payload={seriesList.map((s, i) => ({ value: s.name, type: "line", color: PALETTE[i % PALETTE.length], id: s.id }))} />
                    {seriesList.map((s, i) => (
                      <Line key={s.id} type="monotone" dataKey={s.id} stroke={PALETTE[i % PALETTE.length]} strokeWidth={s.isBaseline ? 2.5 : 1.6} dot={false} isAnimationActive={false} legendType="none" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Running all scenarios…" : "Run a stress comparison to see results."}
          </div>
        )}
      </section>
    </div>
  );
}
