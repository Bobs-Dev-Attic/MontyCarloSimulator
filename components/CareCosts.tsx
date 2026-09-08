"use client";

import { useCallback, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import Field from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import { usePersistentState } from "@/lib/persist";
import { useAutoRun } from "@/lib/preferences";
import { useApplyAllHandler } from "@/lib/broadcast";
import { useProgress } from "@/lib/progress";
import { useChartColors } from "@/lib/chartColors";
import { useTabHistory } from "@/lib/tabHistory";
import TabHistoryPanel from "@/components/TabHistoryPanel";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { CareResult } from "@/lib/careCosts";

const ACTIVE_COLOR = "#34d399";
const ASSISTED_COLOR = "#f59e0b";
const SKILLED_COLOR = "#f87171";
const DEAD_COLOR = "#64748b";

export default function CareCosts() {
  const [startAge, setStartAge] = usePersistentState("care.startAge", 65);
  const [startingBalance, setStartingBalance] = usePersistentState("care.startingBalance", 1_000_000);
  const [baseSpend, setBaseSpend] = usePersistentState("care.baseSpend", 45_000);
  const [realReturn, setRealReturn] = usePersistentState("care.realReturn", 0.035);
  const [vol, setVol] = usePersistentState("care.vol", 0.1);
  const [assistedCost, setAssistedCost] = usePersistentState("care.assistedCost", 60_000);
  const [skilledCost, setSkilledCost] = usePersistentState("care.skilledCost", 110_000);
  const [actToAssisted, setActToAssisted] = usePersistentState("care.actToAssisted", 0.03);
  const [asstToSkilled, setAsstToSkilled] = usePersistentState("care.asstToSkilled", 0.1);
  const [actToDead, setActToDead] = usePersistentState("care.actToDead", 0.012);
  const [ageRamp, setAgeRamp] = usePersistentState("care.ageRamp", 0.05);
  const [nSims, setNSims] = usePersistentState("care.nSims", 10_000);

  const [data, setData] = useState<CareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();
  const c = useChartColors();
  const history = useTabHistory("care");

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setStartingBalance(value);
      else if (key === "nSims") setNSims(value);
    }, [setStartingBalance, setNSims])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("care", nSims * 45, "Simulating health transitions");
    try {
      const res = await fetch("/api/simulate/care-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAge, startingBalance, baseSpend, realReturn, vol,
          assistedCost, skilledCost, actToAssisted, asstToSkilled, actToDead, ageRamp,
          nSims, seed: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      const d = json as CareResult;
      setData(d);
      history.add({
        label: `Age ${startAge} · ${formatCompact(startingBalance)} · care +${formatCompact(assistedCost)}/${formatCompact(skilledCost)}`,
        inputs: { startAge, startingBalance, baseSpend, realReturn, vol, assistedCost, skilledCost, actToAssisted, asstToSkilled, actToDead, ageRamp, nSims },
        metrics: [
          { label: "Need care", value: formatPercent(d.probEverCare) },
          { label: "Ruin w/ care", value: formatPercent(d.ruinWithCare) },
          { label: "Ruin no care", value: formatPercent(d.ruinNoCare) },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [startAge, startingBalance, baseSpend, realReturn, vol, assistedCost, skilledCost, actToAssisted, asstToSkilled, actToDead, ageRamp, nSims, progress, history]);

  useAutoRun(run);

  const restore = (inp: Record<string, unknown>) => {
    const set = (k: string, fn: (v: number) => void) => {
      if (typeof inp[k] === "number") fn(inp[k] as number);
    };
    set("startAge", setStartAge);
    set("startingBalance", setStartingBalance);
    set("baseSpend", setBaseSpend);
    set("realReturn", setRealReturn);
    set("vol", setVol);
    set("assistedCost", setAssistedCost);
    set("skilledCost", setSkilledCost);
    set("actToAssisted", setActToAssisted);
    set("asstToSkilled", setAsstToSkilled);
    set("actToDead", setActToDead);
    set("ageRamp", setAgeRamp);
    set("nSims", setNSims);
  };

  const occRows = data
    ? data.years.map((t, i) => ({
        age: startAge + t,
        Active: data.occupancy.active[i] * 100,
        Assisted: data.occupancy.assisted[i] * 100,
        Skilled: data.occupancy.skilled[i] * 100,
        Dead: data.occupancy.dead[i] * 100,
      }))
    : [];

  const costRows = data
    ? data.careCostHist.counts.map((count, i) => ({
        cost: (data.careCostHist.edges[i] + data.careCostHist.edges[i + 1]) / 2,
        count,
      }))
    : [];

  const ruinRows = data
    ? [
        { name: "Without care costs", id: "no", ruin: data.ruinNoCare },
        { name: "With care costs", id: "with", ruin: data.ruinWithCare },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Plan</h2>
        <div className="space-y-4">
          <Field label="Current age" info="careMarkov" value={startAge} onChange={(v) => setStartAge(Math.round(v))} min={50} max={90} step={1} display={`${startAge}`} />
          <Field label="Balance" info="beginningValue" value={startingBalance} onChange={setStartingBalance} min={100_000} max={10_000_000} step={10_000} display={formatCurrency(startingBalance)} sharedKey="beginningValue" />
          <Field label="Base living spend" info="withdrawal" value={baseSpend} onChange={setBaseSpend} min={10_000} max={300_000} step={2500} display={formatCurrency(baseSpend)} hint="excludes care costs" />
          <Field label="Real return" info="real" value={realReturn} onChange={setRealReturn} min={-0.02} max={0.08} step={0.005} display={formatPercent(realReturn)} />
          <Field label="Volatility" info="sigma" value={vol} onChange={setVol} min={0} max={0.3} step={0.005} display={formatPercent(vol)} />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Care costs <InfoTip term="careCost" /></h3>
        <div className="space-y-4">
          <Field label="Assisted living / yr" info="careCost" value={assistedCost} onChange={setAssistedCost} min={0} max={200_000} step={5000} display={formatCurrency(assistedCost)} />
          <Field label="Skilled nursing / yr" info="careCost" value={skilledCost} onChange={setSkilledCost} min={0} max={300_000} step={5000} display={formatCurrency(skilledCost)} />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Transitions <InfoTip term="careTransition" /></h3>
        <div className="space-y-4">
          <Field label="Active → assisted / yr" info="careTransition" value={actToAssisted} onChange={setActToAssisted} min={0} max={0.15} step={0.005} display={formatPercent(actToAssisted)} />
          <Field label="Assisted → skilled / yr" info="careTransition" value={asstToSkilled} onChange={setAsstToSkilled} min={0} max={0.4} step={0.01} display={formatPercent(asstToSkilled)} />
          <Field label="Active mortality / yr" info="careTransition" value={actToDead} onChange={setActToDead} min={0} max={0.1} step={0.002} display={formatPercent(actToDead)} />
          <Field label="Age acceleration" info="careTransition" value={ageRamp} onChange={setAgeRamp} min={0} max={0.15} step={0.01} display={`${(ageRamp * 100).toFixed(0)}%/yr`} hint="how fast risks rise after 70" />
        </div>

        <div className="my-5 h-px bg-line" />
        <Field label="Simulations" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={50_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />

        <button onClick={run} disabled={loading} className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Simulating…" : "Run care-cost simulation"}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          Health follows a Markov chain (Active → Assisted → Skilled → Deceased)
          with age-rising transition rates. The portfolio is run with and without
          care costs on the same paths. Values are in today&apos;s $.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">
                What long-term care does to the plan <InfoTip term="careMarkov" />
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-bold tabular-nums text-accent">{formatPercent(data.probEverCare)}</span>
                <span className="pb-1 text-sm text-muted">will need assisted living or skilled nursing at some point</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Care costs raise the chance of running out of money from{" "}
                <span className="font-semibold text-white">{formatPercent(data.ruinNoCare)}</span> to{" "}
                <span className="font-semibold text-bad">{formatPercent(data.ruinWithCare)}</span>. Among those who
                need care, the median stay is{" "}
                <span className="font-semibold text-white">{data.medianYearsInCare.toFixed(1)} years</span>; lifetime
                care spending has a median of{" "}
                <span className="font-semibold text-white">{formatCurrency(data.medianLifetimeCareCost)}</span> and a
                1-in-10 case above <span className="font-semibold text-white">{formatCurrency(data.p90LifetimeCareCost)}</span>.
              </p>
            </div>

            {/* Ruin comparison */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Ruin: with vs. without care costs <InfoTip term="ruinProb" /></h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={ruinRows} margin={{ top: 8, right: 40, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke={c.axis} tick={{ fontSize: 11 }} domain={[0, "dataMax"]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                    <YAxis type="category" dataKey="name" stroke={c.axis} tick={{ fontSize: 11 }} width={140} />
                    <Tooltip cursor={{ fill: c.muted, fillOpacity: 0.08 }} contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatPercent(v), "Ruin probability"]} />
                    <Bar dataKey="ruin" isAnimationActive={false} radius={2}>
                      {ruinRows.map((r) => (
                        <Cell key={r.id} fill={r.id === "with" ? SKILLED_COLOR : ACTIVE_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* State occupancy over time */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Where people are by age <InfoTip term="careMarkov" /></h3>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={occRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="age" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Age", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Age ${v}`} formatter={(value: number, key: string) => [`${value.toFixed(1)}%`, key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Active" stackId="1" stroke={ACTIVE_COLOR} fill={ACTIVE_COLOR} fillOpacity={0.75} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Assisted" stackId="1" stroke={ASSISTED_COLOR} fill={ASSISTED_COLOR} fillOpacity={0.75} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Skilled" stackId="1" stroke={SKILLED_COLOR} fill={SKILLED_COLOR} fillOpacity={0.75} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Dead" stackId="1" stroke={DEAD_COLOR} fill={DEAD_COLOR} fillOpacity={0.55} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted">Share of the cohort in each state at each age (Active + Assisted + Skilled + Deceased = 100%).</p>
            </div>

            {/* Lifetime care cost distribution */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Distribution of lifetime care cost</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="cost" stroke={c.axis} tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCompact(v)} label={{ value: "Lifetime care cost (today's $)", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip cursor={{ fill: c.muted, fillOpacity: 0.08 }} contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `≈ ${formatCurrency(v)}`} formatter={(v: number) => [`${v} paths`, "Count"]} />
                    <Bar dataKey="count" fill={ASSISTED_COLOR} fillOpacity={0.85} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted">Many paths never need paid care ($0); the long right tail is the risk a plan must be able to absorb.</p>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Simulating health transitions…" : "Run a care-cost simulation to see results."}
          </div>
        )}

        <TabHistoryPanel history={history} onRestore={restore} />
      </section>
    </div>
  );
}
