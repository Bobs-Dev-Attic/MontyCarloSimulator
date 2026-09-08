"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Field from "@/components/Field";
import FanChart from "@/components/FanChart";
import Histogram from "@/components/Histogram";
import StatCards from "@/components/StatCards";
import InfoTip from "@/components/InfoTip";
import GlidePathEditor from "@/components/GlidePathEditor";
import { RealBadge } from "@/components/RealToggle";
import { useReal } from "@/lib/realContext";
import { usePersistentState } from "@/lib/persist";
import { useApplyAllHandler } from "@/lib/broadcast";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { SimulationResponse } from "@/lib/types";
import type { Waypoint } from "@/lib/glidepath";

const DEFAULT_WAYPOINTS: Waypoint[] = [
  { year: 0, alloc: 0.9 },
  { year: 20, alloc: 0.6 },
  { year: 40, alloc: 0.3 },
];

interface CurvePoint {
  year: number;
  alloc: number;
  vol: number;
  mu: number;
}

export default function RiskGlidePath() {
  const [years, setYears] = usePersistentState("glide.years", 40);
  const [beginningValue, setBeginningValue] = usePersistentState("glide.beginningValue", 100_000);
  const [annualContribution, setAnnualContribution] = usePersistentState("glide.annualContribution", 10_000);
  const [nSims, setNSims] = usePersistentState("glide.nSims", 10_000);

  const [riskyMu, setRiskyMu] = usePersistentState("glide.riskyMu", 0.08);
  const [riskySigma, setRiskySigma] = usePersistentState("glide.riskySigma", 0.17);
  const [safeMu, setSafeMu] = usePersistentState("glide.safeMu", 0.03);
  const [safeSigma, setSafeSigma] = usePersistentState("glide.safeSigma", 0.05);
  const [rho, setRho] = usePersistentState("glide.rho", 0.1);

  const [waypoints, setWaypoints] = usePersistentState<Waypoint[]>("glide.waypoints", DEFAULT_WAYPOINTS);

  const [data, setData] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { adjust } = useReal();
  const view = data ? adjust(data) : null;

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setBeginningValue(value);
      else if (key === "years") setYears(Math.round(value));
      else if (key === "nSims") setNSims(Math.round(value));
      else if (key === "mu") setRiskyMu(value);
      else if (key === "sigma") setRiskySigma(value);
    }, [setBeginningValue, setYears, setNSims, setRiskyMu, setRiskySigma])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate/glidepath", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskyMu, riskySigma, safeMu, safeSigma, rho,
          waypoints, beginningValue, years, annualContribution, nSims, seed: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      setData(json as SimulationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [riskyMu, riskySigma, safeMu, safeSigma, rho, waypoints, beginningValue, years, annualContribution, nSims]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const curve: CurvePoint[] = (data?.meta.curve as CurvePoint[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      {/* Glide path editor */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1 text-sm font-semibold text-slate-200">Risk tolerance over time (glide path) <InfoTip term="glidePath" /></h3>
          <span className="text-xs text-muted">risky-asset allocation across {years} years</span>
        </div>
        <GlidePathEditor waypoints={waypoints} horizon={years} onChange={setWaypoints} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setWaypoints([{ year: 0, alloc: 0.9 }, { year: Math.round(years / 2), alloc: 0.6 }, { year: years, alloc: 0.3 }])} className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-slate-200 hover:bg-panel2">Declining (target-date)</button>
          <button onClick={() => setWaypoints([{ year: 0, alloc: 0.6 }, { year: years, alloc: 0.6 }])} className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-slate-200 hover:bg-panel2">Constant 60/40</button>
          <button onClick={() => setWaypoints([{ year: 0, alloc: 0.3 }, { year: years, alloc: 0.9 }])} className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-slate-200 hover:bg-panel2">Rising equity</button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regime inputs */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Sleeves</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-accent">Risky sleeve (e.g. equities)</div>
            <Field label="Return μ" info="mu" value={riskyMu} onChange={setRiskyMu} min={-0.02} max={0.15} step={0.005} display={formatPercent(riskyMu)} sharedKey="mu" />
            <Field label="Volatility σ" info="sigma" value={riskySigma} onChange={setRiskySigma} min={0.02} max={0.4} step={0.005} display={formatPercent(riskySigma)} sharedKey="sigma" />
            <div className="col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-accent2">Safe sleeve (e.g. bonds/cash)</div>
            <Field label="Return μ" info="mu" value={safeMu} onChange={setSafeMu} min={-0.01} max={0.08} step={0.0025} display={formatPercent(safeMu)} />
            <Field label="Volatility σ" info="sigma" value={safeSigma} onChange={setSafeSigma} min={0} max={0.15} step={0.0025} display={formatPercent(safeSigma)} />
            <div className="col-span-2">
              <Field label="Correlation (risky↔safe)" info="correlation" value={rho} onChange={setRho} min={-1} max={1} step={0.05} display={rho.toFixed(2)} />
            </div>
          </div>
        </section>

        {/* Portfolio settings */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Plan</h3>
          <div className="space-y-4">
            <Field label="Beginning value" info="beginningValue" value={beginningValue} onChange={setBeginningValue} min={0} max={5_000_000} step={1000} display={formatCurrency(beginningValue)} sharedKey="beginningValue" />
            <Field label="Annual contribution" info="contribution" value={annualContribution} onChange={setAnnualContribution} min={0} max={100_000} step={1000} display={formatCurrency(annualContribution)} />
            <Field label="Time horizon" info="years" value={years} onChange={(v) => setYears(Math.round(v))} min={1} max={50} step={1} display={`${years} yr`} sharedKey="years" />
            <Field label="Simulations" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={50_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />
          </div>
          <button onClick={run} disabled={loading} className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Simulating…" : "Run glide-path simulation"}
          </button>
        </section>
      </div>

      {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

      {data ? (
        <>
          <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">Glide path effect <InfoTip term="glidePath" /></div>
            <p className="mt-1 text-sm text-slate-300">
              Risk falls from <span className="font-semibold text-accent">{formatPercent((data.meta.startAlloc as number) ?? 0)}</span> risky at the start to{" "}
              <span className="font-semibold text-accent">{formatPercent((data.meta.endAlloc as number) ?? 0)}</span> by year {years}. Median ending value{" "}
              <span className="font-semibold text-white">{formatCurrency((view ?? data).summary.median)}</span>, with the fan below narrowing as the portfolio de-risks.
            </p>
          </div>

          {/* Blended risk/return over time */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Effective allocation &amp; volatility over time <InfoTip term="rebalance" /></h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curve} margin={{ top: 8, right: 44, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
                  <XAxis dataKey="year" stroke="#8ea1c0" tick={{ fontSize: 11 }} label={{ value: "Years", position: "insideBottom", offset: -2, fill: "#8ea1c0", fontSize: 11 }} />
                  <YAxis yAxisId="a" stroke="#f59e0b" tick={{ fontSize: 11 }} width={44} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <YAxis yAxisId="v" orientation="right" stroke="#38bdf8" tick={{ fontSize: 11 }} width={44} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <Tooltip
                    contentStyle={{ background: "#0e1626", border: "1px solid #1e2a44", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#8ea1c0" }}
                    formatter={(v: number, n: string) => [formatPercent(v), n === "alloc" ? "Risky allocation" : "Portfolio volatility"]}
                    labelFormatter={(y: number) => `Year ${y}`}
                  />
                  <Area yAxisId="a" type="monotone" dataKey="alloc" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
                  <Line yAxisId="v" type="monotone" dataKey="vol" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11px] text-muted">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#f59e0b" }} />risky allocation (left)</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#38bdf8" }} />portfolio volatility (right)</span>
            </div>
          </div>

          <StatCards data={view!} />

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">Portfolio value: trajectories &amp; percentile bands <RealBadge /></h3>
            <FanChart data={view!} />
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">Distribution of terminal value <RealBadge /></h3>
            <Histogram data={view!} />
          </div>
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
          {loading ? "Simulating glide path…" : "Run a simulation to see results."}
        </div>
      )}
    </div>
  );
}
