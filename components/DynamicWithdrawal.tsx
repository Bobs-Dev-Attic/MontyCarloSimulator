"use client";

import { useCallback, useState } from "react";
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
import InfoTip from "@/components/InfoTip";
import { usePersistentState } from "@/lib/persist";
import { useAutoRun } from "@/lib/preferences";
import { useApplyAllHandler } from "@/lib/broadcast";
import { useProgress } from "@/lib/progress";
import { useChartColors } from "@/lib/chartColors";
import { useTabHistory } from "@/lib/tabHistory";
import TabHistoryPanel from "@/components/TabHistoryPanel";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { DynamicWithdrawalResult, WithdrawalStrategy } from "@/lib/dynamicWithdrawal";

const STRAT_COLOR: Record<WithdrawalStrategy, string> = {
  fixed: "#f59e0b",
  guardrails: "#34d399",
  ratchet: "#38bdf8",
};

export default function DynamicWithdrawal() {
  const [startingBalance, setStartingBalance] = usePersistentState("dyn.startingBalance", 1_000_000);
  const [retirementYears, setRetirementYears] = usePersistentState("dyn.retirementYears", 30);
  const [initialRate, setInitialRate] = usePersistentState("dyn.initialRate", 0.05);
  const [meanReturn, setMeanReturn] = usePersistentState("dyn.meanReturn", 0.06);
  const [stdReturn, setStdReturn] = usePersistentState("dyn.stdReturn", 0.12);
  const [inflation, setInflation] = usePersistentState("dyn.inflation", 0.025);
  const [guardBand, setGuardBand] = usePersistentState("dyn.guardBand", 0.2);
  const [guardAdjust, setGuardAdjust] = usePersistentState("dyn.guardAdjust", 0.1);
  const [ratchetThreshold, setRatchetThreshold] = usePersistentState("dyn.ratchetThreshold", 0.5);
  const [ratchetStep, setRatchetStep] = usePersistentState("dyn.ratchetStep", 0.1);
  const [ratchetEvery, setRatchetEvery] = usePersistentState("dyn.ratchetEvery", 3);
  const [nSims, setNSims] = usePersistentState("dyn.nSims", 8000);

  const [data, setData] = useState<DynamicWithdrawalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();
  const c = useChartColors();
  const history = useTabHistory("dynwithdraw");

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setStartingBalance(value);
      else if (key === "mu") setMeanReturn(value);
      else if (key === "sigma") setStdReturn(value);
      else if (key === "nSims") setNSims(value);
    }, [setStartingBalance, setMeanReturn, setStdReturn, setNSims])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("dynwithdraw", nSims * Math.max(1, retirementYears) * 3, "Comparing withdrawal strategies");
    try {
      const res = await fetch("/api/simulate/dynamic-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startingBalance, retirementYears, initialRate, meanReturn, stdReturn, inflation,
          guardBand, guardAdjust, ratchetThreshold, ratchetStep, ratchetEvery, nSims, seed: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      const d = json as DynamicWithdrawalResult;
      setData(d);
      const f = d.strategies.find((s) => s.id === "fixed");
      const g = d.strategies.find((s) => s.id === "guardrails");
      history.add({
        label: `${formatCompact(startingBalance)} · ${formatPercent(initialRate)} · ${retirementYears}y`,
        inputs: { startingBalance, retirementYears, initialRate, meanReturn, stdReturn, inflation, guardBand, guardAdjust, ratchetThreshold, ratchetStep, ratchetEvery, nSims },
        metrics: [
          { label: "Fixed ruin", value: formatPercent(f?.ruinProb ?? 0) },
          { label: "Guardrails ruin", value: formatPercent(g?.ruinProb ?? 0) },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [startingBalance, retirementYears, initialRate, meanReturn, stdReturn, inflation, guardBand, guardAdjust, ratchetThreshold, ratchetStep, ratchetEvery, nSims, progress, history]);

  useAutoRun(run);

  const fixed = data?.strategies.find((s) => s.id === "fixed");
  const guard = data?.strategies.find((s) => s.id === "guardrails");

  // Median real spending over time, one series per strategy.
  const spendRows = data
    ? data.strategies[0].spendBands.steps.map((yr, i) => {
        const row: Record<string, number> = { year: yr };
        data.strategies.forEach((st) => (row[st.id] = st.spendBands.p50[i]));
        return row;
      })
    : [];

  // Median real balance over time, one series per strategy.
  const balanceRows = data
    ? data.strategies[0].balanceBands.steps.map((yr, i) => {
        const row: Record<string, number> = { year: yr };
        data.strategies.forEach((st) => (row[st.id] = st.balanceBands.p50[i]));
        return row;
      })
    : [];

  const ruinRows = data ? data.strategies.map((s) => ({ name: s.name, id: s.id, ruin: s.ruinProb })) : [];

  const restore = (inp: Record<string, unknown>) => {
    const set = (k: string, fn: (v: number) => void) => {
      if (typeof inp[k] === "number") fn(inp[k] as number);
    };
    set("startingBalance", setStartingBalance);
    set("retirementYears", setRetirementYears);
    set("initialRate", setInitialRate);
    set("meanReturn", setMeanReturn);
    set("stdReturn", setStdReturn);
    set("inflation", setInflation);
    set("guardBand", setGuardBand);
    set("guardAdjust", setGuardAdjust);
    set("ratchetThreshold", setRatchetThreshold);
    set("ratchetStep", setRatchetStep);
    set("ratchetEvery", setRatchetEvery);
    set("nSims", setNSims);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Plan</h2>
        <div className="space-y-4">
          <Field label="Balance at retirement" info="beginningValue" value={startingBalance} onChange={setStartingBalance} min={50_000} max={10_000_000} step={10_000} display={formatCurrency(startingBalance)} sharedKey="beginningValue" />
          <Field label="Years in retirement" info="years" value={retirementYears} onChange={(v) => setRetirementYears(Math.round(v))} min={5} max={50} step={1} display={`${retirementYears} yr`} />
          <Field label="Initial withdrawal rate" info="withdrawalRate" value={initialRate} onChange={setInitialRate} min={0.02} max={0.1} step={0.0025} display={formatPercent(initialRate)} hint={`≈ ${formatCurrency(initialRate * startingBalance)} in year 1`} />
          <Field label="Expected return (μ)" info="mu" value={meanReturn} onChange={setMeanReturn} min={-0.02} max={0.15} step={0.005} display={formatPercent(meanReturn)} sharedKey="mu" />
          <Field label="Volatility (σ)" info="sigma" value={stdReturn} onChange={setStdReturn} min={0.01} max={0.4} step={0.005} display={formatPercent(stdReturn)} sharedKey="sigma" />
          <Field label="Inflation" info="inflation" value={inflation} onChange={setInflation} min={0} max={0.1} step={0.0025} display={formatPercent(inflation)} />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Guardrails <InfoTip term="guardrails" /></h3>
        <div className="space-y-4">
          <Field label="Guardrail band (±)" info="guardrails" value={guardBand} onChange={setGuardBand} min={0.05} max={0.4} step={0.05} display={formatPercent(guardBand)} hint="rate drift that triggers a change" />
          <Field label="Spending adjustment" info="guardrails" value={guardAdjust} onChange={setGuardAdjust} min={0.05} max={0.25} step={0.05} display={formatPercent(guardAdjust)} hint="size of each cut / raise" />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Ratchet <InfoTip term="ratchet" /></h3>
        <div className="space-y-4">
          <Field label="Growth to unlock raise" info="ratchet" value={ratchetThreshold} onChange={setRatchetThreshold} min={0.1} max={1} step={0.05} display={formatPercent(ratchetThreshold)} hint="real growth over starting balance" />
          <Field label="Raise size" info="ratchet" value={ratchetStep} onChange={setRatchetStep} min={0.05} max={0.25} step={0.05} display={formatPercent(ratchetStep)} />
          <Field label="Check every" info="ratchet" value={ratchetEvery} onChange={(v) => setRatchetEvery(Math.round(v))} min={1} max={10} step={1} display={`${ratchetEvery} yr`} />
        </div>

        <div className="my-5 h-px bg-line" />
        <Field label="Simulations" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={20_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />

        <button onClick={run} disabled={loading} className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Simulating…" : "Compare strategies"}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          All strategies run on the same market paths (common random numbers), so
          differences reflect the spending rule — not luck. Values are in today&apos;s $.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="text-xs uppercase tracking-wide text-muted">Adaptive spending vs. fixed</div>
              {fixed && guard ? (
                <>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <span className="text-4xl font-bold tabular-nums text-good">
                      {formatPercent(Math.max(0, fixed.ruinProb - guard.ruinProb))}
                    </span>
                    <span className="pb-1 text-sm text-muted">
                      lower chance of running out with guardrails
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Fixed inflation-adjusted spending runs out in{" "}
                    <span className="font-semibold text-bad">{formatPercent(fixed.ruinProb)}</span> of paths;
                    Guyton–Klinger guardrails cut that to{" "}
                    <span className="font-semibold text-good">{formatPercent(guard.ruinProb)}</span> by
                    trimming spending after poor markets. The trade-off is variable income — see the
                    spending path below.
                  </p>
                </>
              ) : null}
            </div>

            {/* Comparison table */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Strategy comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Strategy</th>
                      <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Ruin prob. <InfoTip term="ruinProb" /></span></th>
                      <th className="pb-2 text-right font-medium">Success</th>
                      <th className="pb-2 text-right font-medium">Median ending</th>
                      <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Total spend <InfoTip term="totalSpend" /></span></th>
                      <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Spend cuts <InfoTip term="spendCuts" /></span></th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.strategies.map((s) => (
                      <tr key={s.id} className="border-t border-line/50">
                        <td className="py-1.5 text-slate-200">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: STRAT_COLOR[s.id] }} />
                          {s.name}
                        </td>
                        <td className={`py-1.5 text-right ${s.ruinProb <= 0.1 ? "text-good" : s.ruinProb <= 0.25 ? "text-accent" : "text-bad"}`}>{formatPercent(s.ruinProb)}</td>
                        <td className="py-1.5 text-right">{formatPercent(s.successRate)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(s.medianTerminalReal)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(s.medianTotalRealSpend)}</td>
                        <td className="py-1.5 text-right text-muted">{s.avgCutYears.toFixed(1)} yrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted">Ending balance &amp; total spend are medians in today&apos;s $. Spend cuts = average number of years spending fell in real terms.</p>
            </div>

            {/* Ruin probability bars */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Probability of running out <InfoTip term="ruinProb" /></h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={ruinRows} margin={{ top: 8, right: 40, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke={c.axis} tick={{ fontSize: 11 }} domain={[0, "dataMax"]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                    <YAxis type="category" dataKey="name" stroke={c.axis} tick={{ fontSize: 11 }} width={160} />
                    <Tooltip cursor={{ fill: c.muted, fillOpacity: 0.08 }} contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatPercent(v), "Ruin probability"]} />
                    <Bar dataKey="ruin" isAnimationActive={false} radius={2}>
                      {ruinRows.map((r) => (
                        <Cell key={r.id} fill={STRAT_COLOR[r.id as WithdrawalStrategy]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Median real spending over time */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Median real spending over time <InfoTip term="realSpending" /></h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spendRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Retirement year", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Year ${v}`} formatter={(value: number, key: string) => [formatCurrency(value), data.strategies.find((s) => s.id === key)?.name ?? key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} payload={data.strategies.map((s) => ({ value: s.name, type: "line", color: STRAT_COLOR[s.id], id: s.id }))} />
                    {data.strategies.map((s) => (
                      <Line key={s.id} type="monotone" dataKey={s.id} stroke={STRAT_COLOR[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Median real balance over time */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Median real balance over time</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={balanceRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Retirement year", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Year ${v}`} formatter={(value: number, key: string) => [formatCurrency(value), data.strategies.find((s) => s.id === key)?.name ?? key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} payload={data.strategies.map((s) => ({ value: s.name, type: "line", color: STRAT_COLOR[s.id], id: s.id }))} />
                    {data.strategies.map((s) => (
                      <Line key={s.id} type="monotone" dataKey={s.id} stroke={STRAT_COLOR[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Comparing strategies…" : "Run a comparison to see results."}
          </div>
        )}

        <TabHistoryPanel history={history} onRestore={restore} />
      </section>
    </div>
  );
}
