"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import Field from "@/components/Field";
import Histogram from "@/components/Histogram";
import InfoTip from "@/components/InfoTip";
import { RealBadge } from "@/components/RealToggle";
import { useReal } from "@/lib/realContext";
import { usePersistentState } from "@/lib/persist";
import { useApplyAllHandler } from "@/lib/broadcast";
import { useProgress } from "@/lib/progress";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import { SCENARIOS, scenarioById } from "@/lib/scenarios";
import { useChartColors } from "@/lib/chartColors";
import type { MacroShockResponse } from "@/lib/run";

const BASE_COLOR = "#34d399";
const SHOCK_COLOR = "#f59e0b";

function StatCard({
  label,
  value,
  sub,
  tone = "default",
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "accent";
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
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}

export default function MacroShock() {
  const [scenarioId, setScenarioId] = usePersistentState("macro.scenarioId", "gfc");

  // Base portfolio inputs
  const [beginningValue, setBeginningValue] = usePersistentState("macro.beginningValue", 100_000);
  const [mu, setMu] = usePersistentState("macro.mu", 0.07);
  const [sigma, setSigma] = usePersistentState("macro.sigma", 0.15);
  const [years, setYears] = usePersistentState("macro.years", 20);
  const [nSims, setNSims] = usePersistentState("macro.nSims", 10_000);

  // Shock params (seeded from the chosen scenario, then tweakable)
  const [annualProb, setAnnualProb] = usePersistentState("macro.annualProb", scenarioById("gfc").config.annualProb);
  const [severityMean, setSeverityMean] = usePersistentState("macro.severityMean", scenarioById("gfc").config.severityMean);
  const [volMultiplier, setVolMultiplier] = usePersistentState("macro.volMultiplier", scenarioById("gfc").config.volMultiplier);
  const [recoveryYears, setRecoveryYears] = usePersistentState("macro.recoveryYears", scenarioById("gfc").config.recoveryYears);
  const [driftDelta, setDriftDelta] = usePersistentState("macro.driftDelta", scenarioById("gfc").config.annualDriftDelta ?? 0);

  const [data, setData] = useState<MacroShockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setBeginningValue(value);
      else if (key === "mu") setMu(value);
      else if (key === "sigma") setSigma(value);
      else if (key === "years") setYears(value);
      else if (key === "nSims") setNSims(value);
    }, [setBeginningValue, setMu, setSigma, setYears, setNSims])
  );

  const applyScenario = useCallback((id: string) => {
    setScenarioId(id);
    const c = scenarioById(id).config;
    setAnnualProb(c.annualProb);
    setSeverityMean(c.severityMean);
    setVolMultiplier(c.volMultiplier);
    setRecoveryYears(c.recoveryYears);
    setDriftDelta(c.annualDriftDelta ?? 0);
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("macro", nSims * Math.max(1, years), "Running macro shock simulation");
    try {
      const res = await fetch("/api/simulate/macro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beginningValue,
          mu,
          sigma,
          years,
          nSims,
          seed: 2026,
          shock: {
            annualProb,
            severityMean,
            severityStd: scenarioById(scenarioId).config.severityStd,
            volMultiplier,
            recoveryYears,
            annualDriftDelta: driftDelta,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      setData(json as MacroShockResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [beginningValue, mu, sigma, years, nSims, annualProb, severityMean, volMultiplier, recoveryYears, driftDelta, scenarioId, progress]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenario = scenarioById(scenarioId);

  // Nominal or real (today's $) view depending on the global toggle.
  const { adjust } = useReal();
  const c = useChartColors();
  const base = data ? adjust(data.baseline) : null;
  const shock = data ? adjust(data.shocked) : null;

  const overlayRows = useMemo(() => {
    if (!base || !shock) return [];
    const b = base.bands;
    const s = shock.bands;
    return b.steps.map((x, i) => ({
      x,
      base: b.p50[i],
      shock: s.p50[i],
      shockBand: [s.p5[i], s.p95[i]] as [number, number],
    }));
  }, [base, shock]);

  const medianDrop =
    base && shock && base.summary.median > 0
      ? 1 - shock.summary.median / base.summary.median
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Scenario
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => applyScenario(sc.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                scenarioId === sc.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line text-muted hover:text-slate-200"
              }`}
            >
              {sc.name}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] text-muted">{scenario.blurb}</p>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Shock parameters
        </h3>
        <div className="space-y-4">
          <Field label="Annual probability" info="macroShock" value={annualProb} onChange={setAnnualProb} min={0} max={0.5} step={0.01} display={formatPercent(annualProb)} hint={`≈ ${(annualProb * years).toFixed(1)} expected over ${years}y`} />
          <Field label="Crash severity" info="macroShock" value={severityMean} onChange={setSeverityMean} min={0.02} max={0.8} step={0.01} display={formatPercent(severityMean)} hint="typical instantaneous drop" />
          <Field label="Recovery turbulence (×vol)" info="macroShock" value={volMultiplier} onChange={setVolMultiplier} min={1} max={3} step={0.1} display={`${volMultiplier.toFixed(1)}×`} />
          <Field label="Recovery window" info="macroShock" value={recoveryYears} onChange={setRecoveryYears} min={0} max={5} step={0.5} display={`${recoveryYears} yr`} />
          <Field label="Persistent drift drag" info="macroShock" value={driftDelta} onChange={setDriftDelta} min={-0.06} max={0} step={0.005} display={formatPercent(driftDelta)} hint="e.g. stagflation" />
        </div>

        <div className="my-5 h-px bg-line" />

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Portfolio
        </h3>
        <div className="space-y-4">
          <Field label="Beginning value" info="beginningValue" value={beginningValue} onChange={setBeginningValue} min={1000} max={5_000_000} step={1000} display={formatCurrency(beginningValue)} sharedKey="beginningValue" />
          <Field label="Expected return (μ)" info="mu" value={mu} onChange={setMu} min={-0.05} max={0.2} step={0.005} display={formatPercent(mu)} sharedKey="mu" />
          <Field label="Base volatility (σ)" info="sigma" value={sigma} onChange={setSigma} min={0.01} max={0.6} step={0.005} display={formatPercent(sigma)} sharedKey="sigma" />
          <Field label="Time horizon" info="years" value={years} onChange={setYears} min={1} max={40} step={1} display={`${years} yr`} sharedKey="years" />
          <Field label="Simulations" info="nSims" value={nSims} onChange={setNSims} min={1000} max={50_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Simulating…" : "Run shock simulation"}
        </button>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div>
        ) : null}

        {base && shock ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                Impact of “{scenario.name}” shocks <RealBadge />
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-bold tabular-nums text-bad">
                  −{formatPercent(medianDrop)}
                </span>
                <span className="pb-1 text-sm text-muted">
                  to the median outcome ({formatCurrency(base.summary.median)} →{" "}
                  {formatCurrency(shock.summary.median)})
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Over {years} years, {formatPercent((shock.meta.fracWithShock as number) ?? 0)} of paths
                are hit by at least one shock ({((shock.meta.avgShocks as number) ?? 0).toFixed(1)} on
                average). The chance of ending below where you started rises from{" "}
                <span className="font-semibold text-white">{formatPercent(base.summary.probLoss)}</span> to{" "}
                <span className="font-semibold text-bad">{formatPercent(shock.summary.probLoss)}</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Median (baseline)" value={formatCurrency(base.summary.median)} tone="good" info="median" />
              <StatCard label="Median (shocked)" value={formatCurrency(shock.summary.median)} tone="accent" info="median" />
              <StatCard label="P5 baseline → shocked" value={formatCurrency(shock.summary.p5)} sub={`from ${formatCurrency(base.summary.p5)}`} tone="bad" info="percentile" />
              <StatCard label="95% VaR (shocked)" value={formatCurrency(shock.summary.var95)} sub={`baseline ${formatCurrency(base.summary.var95)}`} tone="bad" info="var95" />
              <StatCard label="Prob. of loss" value={formatPercent(shock.summary.probLoss)} sub={`baseline ${formatPercent(base.summary.probLoss)}`} tone="bad" info="probLoss" />
              <StatCard label="Paths hit by a shock" value={formatPercent((shock.meta.fracWithShock as number) ?? 0)} tone="accent" info="shockFrequency" />
              <StatCard label="Avg shocks / path" value={((shock.meta.avgShocks as number) ?? 0).toFixed(2)} info="shockFrequency" />
              <StatCard label="Worst case" value={formatCurrency(shock.summary.min)} sub={`baseline ${formatCurrency(base.summary.min)}`} tone="bad" info="worstCase" />
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">
                Median trajectory: baseline vs shocked
              </h3>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overlayRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="x" stroke={c.axis} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}`} label={{ value: "Years", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: c.axis }}
                      formatter={(value: number, name: string) =>
                        name === "base" ? [formatCompact(value), "Baseline median"] : name === "shock" ? [formatCompact(value), "Shocked median"] : [null, null]
                      }
                      labelFormatter={(v: number) => `Year ${v % 1 === 0 ? v : v.toFixed(1)}`}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      payload={[
                        { value: "Baseline median", type: "line", color: BASE_COLOR, id: "b" },
                        { value: "Shocked median", type: "line", color: SHOCK_COLOR, id: "s" },
                        { value: "Shocked p5–p95", type: "rect", color: SHOCK_COLOR, id: "band" },
                      ]}
                    />
                    <Area type="monotone" dataKey="shockBand" stroke="none" fill={SHOCK_COLOR} fillOpacity={0.12} isAnimationActive={false} legendType="none" />
                    <Line type="monotone" dataKey="base" stroke={BASE_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                    <Line type="monotone" dataKey="shock" stroke={SHOCK_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">
                Terminal outcomes under shocks
              </h3>
              <Histogram data={shock} />
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Simulating shocks…" : "Run a shock simulation to see results."}
          </div>
        )}
      </section>
    </div>
  );
}
