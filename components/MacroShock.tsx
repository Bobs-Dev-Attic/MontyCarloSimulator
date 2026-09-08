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
import { usePersistentState } from "@/lib/persist";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import { SCENARIOS, scenarioById } from "@/lib/scenarios";
import type { MacroShockResponse } from "@/lib/run";

const BASE_COLOR = "#34d399";
const SHOCK_COLOR = "#f59e0b";

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "accent";
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
    }
  }, [beginningValue, mu, sigma, years, nSims, annualProb, severityMean, volMultiplier, recoveryYears, driftDelta, scenarioId]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenario = scenarioById(scenarioId);

  const overlayRows = useMemo(() => {
    if (!data) return [];
    const b = data.baseline.bands;
    const s = data.shocked.bands;
    return b.steps.map((x, i) => ({
      x,
      base: b.p50[i],
      shock: s.p50[i],
      shockBand: [s.p5[i], s.p95[i]] as [number, number],
    }));
  }, [data]);

  const medianDrop =
    data && data.baseline.summary.median > 0
      ? 1 - data.shocked.summary.median / data.baseline.summary.median
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
          <Field label="Annual probability" value={annualProb} onChange={setAnnualProb} min={0} max={0.5} step={0.01} display={formatPercent(annualProb)} hint={`≈ ${(annualProb * years).toFixed(1)} expected over ${years}y`} />
          <Field label="Crash severity" value={severityMean} onChange={setSeverityMean} min={0.02} max={0.8} step={0.01} display={formatPercent(severityMean)} hint="typical instantaneous drop" />
          <Field label="Recovery turbulence (×vol)" value={volMultiplier} onChange={setVolMultiplier} min={1} max={3} step={0.1} display={`${volMultiplier.toFixed(1)}×`} />
          <Field label="Recovery window" value={recoveryYears} onChange={setRecoveryYears} min={0} max={5} step={0.5} display={`${recoveryYears} yr`} />
          <Field label="Persistent drift drag" value={driftDelta} onChange={setDriftDelta} min={-0.06} max={0} step={0.005} display={formatPercent(driftDelta)} hint="e.g. stagflation" />
        </div>

        <div className="my-5 h-px bg-line" />

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Portfolio
        </h3>
        <div className="space-y-4">
          <Field label="Beginning value" value={beginningValue} onChange={setBeginningValue} min={1000} max={5_000_000} step={1000} display={formatCurrency(beginningValue)} />
          <Field label="Expected return (μ)" value={mu} onChange={setMu} min={-0.05} max={0.2} step={0.005} display={formatPercent(mu)} />
          <Field label="Base volatility (σ)" value={sigma} onChange={setSigma} min={0.01} max={0.6} step={0.005} display={formatPercent(sigma)} />
          <Field label="Time horizon" value={years} onChange={setYears} min={1} max={40} step={1} display={`${years} yr`} />
          <Field label="Simulations" value={nSims} onChange={setNSims} min={1000} max={50_000} step={1000} display={nSims.toLocaleString()} />
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

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="text-xs uppercase tracking-wide text-muted">
                Impact of “{scenario.name}” shocks
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-bold tabular-nums text-bad">
                  −{formatPercent(medianDrop)}
                </span>
                <span className="pb-1 text-sm text-muted">
                  to the median outcome ({formatCurrency(data.baseline.summary.median)} →{" "}
                  {formatCurrency(data.shocked.summary.median)})
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Over {years} years, {formatPercent((data.shocked.meta.fracWithShock as number) ?? 0)} of paths
                are hit by at least one shock ({((data.shocked.meta.avgShocks as number) ?? 0).toFixed(1)} on
                average). The chance of ending below where you started rises from{" "}
                <span className="font-semibold text-white">{formatPercent(data.baseline.summary.probLoss)}</span> to{" "}
                <span className="font-semibold text-bad">{formatPercent(data.shocked.summary.probLoss)}</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Median (baseline)" value={formatCurrency(data.baseline.summary.median)} tone="good" />
              <StatCard label="Median (shocked)" value={formatCurrency(data.shocked.summary.median)} tone="accent" />
              <StatCard label="P5 baseline → shocked" value={formatCurrency(data.shocked.summary.p5)} sub={`from ${formatCurrency(data.baseline.summary.p5)}`} tone="bad" />
              <StatCard label="95% VaR (shocked)" value={formatCurrency(data.shocked.summary.var95)} sub={`baseline ${formatCurrency(data.baseline.summary.var95)}`} tone="bad" />
              <StatCard label="Prob. of loss" value={formatPercent(data.shocked.summary.probLoss)} sub={`baseline ${formatPercent(data.baseline.summary.probLoss)}`} tone="bad" />
              <StatCard label="Paths hit by a shock" value={formatPercent((data.shocked.meta.fracWithShock as number) ?? 0)} tone="accent" />
              <StatCard label="Avg shocks / path" value={((data.shocked.meta.avgShocks as number) ?? 0).toFixed(2)} />
              <StatCard label="Worst case" value={formatCurrency(data.shocked.summary.min)} sub={`baseline ${formatCurrency(data.baseline.summary.min)}`} tone="bad" />
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">
                Median trajectory: baseline vs shocked
              </h3>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overlayRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
                    <XAxis dataKey="x" stroke="#8ea1c0" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v % 1 === 0 ? v : v.toFixed(1)}`} label={{ value: "Years", position: "insideBottom", offset: -2, fill: "#8ea1c0", fontSize: 11 }} />
                    <YAxis stroke="#8ea1c0" tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ background: "#0e1626", border: "1px solid #1e2a44", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#8ea1c0" }}
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
              <Histogram data={data.shocked} />
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
