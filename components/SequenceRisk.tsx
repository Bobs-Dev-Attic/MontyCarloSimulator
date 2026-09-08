"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceArea,
  LineChart,
} from "recharts";
import Field from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import { usePersistentState } from "@/lib/persist";
import { useApplyAllHandler } from "@/lib/broadcast";
import { useProgress } from "@/lib/progress";
import { useChartColors } from "@/lib/chartColors";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { SequenceRiskResult } from "@/lib/sequenceRisk";

const SELL_COLOR = "#f87171";
const RUIN_COLOR = "#f59e0b";
const NOBUF_COLOR = "#f87171";
const RECBUF_COLOR = "#34d399";

export default function SequenceRisk() {
  const [startingBalance, setStartingBalance] = usePersistentState("seq.startingBalance", 1_000_000);
  const [retirementYears, setRetirementYears] = usePersistentState("seq.retirementYears", 30);
  const [annualSpend, setAnnualSpend] = usePersistentState("seq.annualSpend", 35_000);
  const [inflation, setInflation] = usePersistentState("seq.inflation", 0.025);
  const [equityMean, setEquityMean] = usePersistentState("seq.equityMean", 0.07);
  const [equityVol, setEquityVol] = usePersistentState("seq.equityVol", 0.16);
  const [bufferYield, setBufferYield] = usePersistentState("seq.bufferYield", 0.03);
  const [bearYears, setBearYears] = usePersistentState("seq.bearYears", 3);
  const [bearMean, setBearMean] = usePersistentState("seq.bearMean", -0.05);
  const [bearVol, setBearVol] = usePersistentState("seq.bearVol", 0.20);
  const [troughDrawdown, setTroughDrawdown] = usePersistentState("seq.troughDrawdown", 0.1);
  const [maxBufferYears, setMaxBufferYears] = usePersistentState("seq.maxBufferYears", 8);
  const [targetSellProb, setTargetSellProb] = usePersistentState("seq.targetSellProb", 0.05);
  const [nSims, setNSims] = usePersistentState("seq.nSims", 6000);

  const [data, setData] = useState<SequenceRiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();
  const c = useChartColors();

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setStartingBalance(value);
      else if (key === "sigma") setEquityVol(value);
      else if (key === "mu") setEquityMean(value);
      else if (key === "nSims") setNSims(value);
    }, [setStartingBalance, setEquityVol, setEquityMean, setNSims])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("seqrisk", nSims * Math.max(1, retirementYears) * (maxBufferYears + 3), "Testing cash-buffer sizes");
    try {
      const res = await fetch("/api/simulate/sequence-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startingBalance, retirementYears, annualSpend, inflation, equityMean, equityVol,
          bufferYield, bearYears, bearMean, bearVol, troughDrawdown, maxBufferYears, targetSellProb,
          nSims, seed: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      setData(json as SequenceRiskResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [startingBalance, retirementYears, annualSpend, inflation, equityMean, equityVol, bufferYield, bearYears, bearMean, bearVol, troughDrawdown, maxBufferYears, targetSellProb, nSims, progress]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sweepRows = data ? data.sweep.map((p) => ({ buffer: p.bufferYears, sell: p.sellProb, ruin: p.ruinProb })) : [];
  const equityRows = data
    ? data.steps.map((yr, i) => ({
        year: yr,
        noBuf: data.equityPathNoBuffer[i],
        rec: data.equityPathRecommended[i],
      }))
    : [];
  const hasRec = Boolean(data?.recommended);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Plan</h2>
        <div className="space-y-4">
          <Field label="Balance at retirement" info="beginningValue" value={startingBalance} onChange={setStartingBalance} min={100_000} max={10_000_000} step={10_000} display={formatCurrency(startingBalance)} sharedKey="beginningValue" />
          <Field label="Years in retirement" info="years" value={retirementYears} onChange={(v) => setRetirementYears(Math.round(v))} min={5} max={50} step={1} display={`${retirementYears} yr`} />
          <Field label="Annual spending (yr 1)" info="withdrawal" value={annualSpend} onChange={setAnnualSpend} min={10_000} max={500_000} step={2500} display={formatCurrency(annualSpend)} hint={`${formatPercent(annualSpend / startingBalance)} of balance`} />
          <Field label="Inflation" info="inflation" value={inflation} onChange={setInflation} min={0} max={0.1} step={0.0025} display={formatPercent(inflation)} />
          <Field label="Equity return (μ)" info="mu" value={equityMean} onChange={setEquityMean} min={0} max={0.15} step={0.005} display={formatPercent(equityMean)} sharedKey="mu" />
          <Field label="Equity volatility (σ)" info="sigma" value={equityVol} onChange={setEquityVol} min={0.05} max={0.4} step={0.005} display={formatPercent(equityVol)} sharedKey="sigma" />
          <Field label="Buffer yield" info="cashBuffer" value={bufferYield} onChange={setBufferYield} min={0} max={0.06} step={0.0025} display={formatPercent(bufferYield)} hint="cash / short-bond return" />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Early bear stress <InfoTip term="bearWindow" /></h3>
        <div className="space-y-4">
          <Field label="Bear window" info="bearWindow" value={bearYears} onChange={(v) => setBearYears(Math.round(v))} min={1} max={7} step={1} display={`${bearYears} yr`} hint="stressed first years" />
          <Field label="Bear equity return (μ)" info="bearWindow" value={bearMean} onChange={setBearMean} min={-0.4} max={0.02} step={0.01} display={formatPercent(bearMean)} />
          <Field label="Bear equity vol (σ)" info="bearWindow" value={bearVol} onChange={setBearVol} min={0.1} max={0.5} step={0.01} display={formatPercent(bearVol)} />
          <Field label="Trough threshold" info="troughDrawdown" value={troughDrawdown} onChange={setTroughDrawdown} min={0.05} max={0.4} step={0.05} display={formatPercent(troughDrawdown)} hint="drop that counts as a trough" />
        </div>

        <div className="my-5 h-px bg-line" />
        <div className="space-y-4">
          <Field label="Max buffer to test" info="cashBuffer" value={maxBufferYears} onChange={(v) => setMaxBufferYears(Math.round(v))} min={2} max={15} step={1} display={`${maxBufferYears} yr`} />
          <Field label="Acceptable trough-sale risk" info="sellAtTrough" value={targetSellProb} onChange={setTargetSellProb} min={0.01} max={0.3} step={0.01} display={formatPercent(targetSellProb)} />
          <Field label="Simulations" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={15_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />
        </div>

        <button onClick={run} disabled={loading} className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Simulating…" : "Analyze sequence risk"}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          Every buffer size is tested on the same stressed market paths, so the
          curve is comparable. The equity sleeve is all-stock and the buffer is
          your only safe asset, so the ruin figures reflect an aggressive plan —
          the focus here is avoiding forced equity sales in the early trough.
          Values are in today&apos;s $.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">
                Recommended cash buffer / bond tent <InfoTip term="bondTent" />
              </div>
              {hasRec && data.recommended ? (
                <>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <span className="text-4xl font-bold tabular-nums text-good">
                      {data.recommendedBufferYears} yr
                    </span>
                    <span className="pb-1 text-sm text-muted">
                      ≈ {formatCurrency(data.recommendedBufferDollars ?? 0)} held in cash / short bonds
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    With no buffer, {formatPercent(data.noBuffer.sellProb)} of stressed paths are forced to
                    sell equities in a trough during the first {data.bearYears} years, and{" "}
                    {formatPercent(data.noBuffer.ruinProb)} run out of money. Holding{" "}
                    <span className="font-semibold text-good">{data.recommendedBufferYears} years</span> of
                    spending as a buffer cuts the trough-sale risk to{" "}
                    <span className="font-semibold text-good">{formatPercent(data.recommended.sellProb)}</span>{" "}
                    (target {formatPercent(data.targetSellProb)}) and ruin to{" "}
                    <span className="font-semibold">{formatPercent(data.recommended.ruinProb)}</span>.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  Even a {maxBufferYears}-year buffer doesn&apos;t get the trough-sale risk below the
                  target of {formatPercent(data.targetSellProb)} under this bear scenario — the stress is
                  severe or spending is high relative to the balance. With no buffer,{" "}
                  {formatPercent(data.noBuffer.sellProb)} of paths sell into a trough. Try a larger max
                  buffer, a milder bear, or lower spending.
                </p>
              )}
            </div>

            {/* Vulnerability curve */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">
                Vulnerability vs. buffer size <InfoTip term="sequenceRisk" />
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sweepRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="buffer" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Buffer (years of spending)", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={46} domain={[0, "dataMax"]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                    <Tooltip
                      contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v: number) => `${v}-year buffer`}
                      formatter={(value: number, key: string) => [formatPercent(value), key === "sell" ? "Sell-at-trough prob." : "Ruin prob."]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} payload={[
                      { value: "Sell-at-trough probability", type: "line", color: SELL_COLOR, id: "sell" },
                      { value: "Ruin probability", type: "line", color: RUIN_COLOR, id: "ruin" },
                    ]} />
                    <Line type="monotone" dataKey="sell" stroke={SELL_COLOR} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} legendType="none" />
                    <Line type="monotone" dataKey="ruin" stroke={RUIN_COLOR} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} legendType="none" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {hasRec ? (
                <p className="mt-2 text-[11px] text-muted">
                  The recommended buffer is the smallest that brings the red line to or below your{" "}
                  {formatPercent(data.targetSellProb)} target: <span className="text-good">{data.recommendedBufferYears} years</span>.
                </p>
              ) : null}
            </div>

            {/* Sweep table */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Buffer sweep</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Buffer</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                      <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Sell at trough <InfoTip term="sellAtTrough" /></span></th>
                      <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Ruin <InfoTip term="ruinProb" /></span></th>
                      <th className="pb-2 text-right font-medium">Median ending</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.sweep.map((p) => {
                      const isRec = data.recommendedBufferYears === p.bufferYears;
                      return (
                        <tr key={p.bufferYears} className={`border-t border-line/50 ${isRec ? "bg-good/10" : ""}`}>
                          <td className="py-1.5 text-slate-200">{p.bufferYears} yr{isRec ? " ★" : ""}</td>
                          <td className="py-1.5 text-right text-muted">{formatCurrency(p.bufferDollars)}</td>
                          <td className={`py-1.5 text-right ${p.sellProb <= data.targetSellProb ? "text-good" : "text-bad"}`}>{formatPercent(p.sellProb)}</td>
                          <td className="py-1.5 text-right">{formatPercent(p.ruinProb)}</td>
                          <td className="py-1.5 text-right">{formatCurrency(p.medianTerminalReal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted">★ = recommended buffer. A bigger buffer lowers trough-sale risk but parks more in low-yield cash, which can raise ruin at the far end.</p>
            </div>

            {/* Equity path: no buffer vs recommended */}
            {hasRec ? (
              <div className="rounded-2xl border border-line bg-panel p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Median equity value through the bear window</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="year" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Retirement year", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                      <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => formatCompact(v)} />
                      <Tooltip
                        contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(v: number) => `Year ${v}`}
                        formatter={(value: number, key: string) => [formatCurrency(value), key === "noBuf" ? "No buffer" : `${data.recommendedBufferYears}-yr buffer`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} payload={[
                        { value: "No buffer", type: "line", color: NOBUF_COLOR, id: "noBuf" },
                        { value: `${data.recommendedBufferYears}-year buffer`, type: "line", color: RECBUF_COLOR, id: "rec" },
                      ]} />
                      <ReferenceArea x1={0} x2={data.bearYears} fill={c.muted} fillOpacity={0.08} />
                      <Line type="monotone" dataKey="noBuf" stroke={NOBUF_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                      <Line type="monotone" dataKey="rec" stroke={RECBUF_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px] text-muted">Shaded = the {data.bearYears}-year bear window. Spending from the buffer instead of selling lets the equity sleeve (green) stay invested and recover, versus drawing it down at the worst time (red).</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Testing buffer sizes…" : "Run the analysis to see results."}
          </div>
        )}
      </section>
    </div>
  );
}
