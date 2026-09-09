"use client";

import { useCallback, useState } from "react";
import { DEFAULTS } from "@/lib/defaults";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
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
import type { LongevityResult, Sex } from "@/lib/mortality";

const A_COLOR = "#38bdf8";
const B_COLOR = "#a78bfa";
const EITHER_COLOR = "#34d399";

function SexToggle({ value, onChange }: { value: Sex; onChange: (s: Sex) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel2 p-0.5">
      {(["male", "female"] as Sex[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
            value === s ? "bg-accent text-ink" : "text-muted hover:text-slate-200"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function Longevity() {
  const [ageA, setAgeA] = usePersistentState("long.ageA", DEFAULTS.longevity.ageA);
  const [sexA, setSexA] = usePersistentState<Sex>("long.sexA", DEFAULTS.longevity.sexA);
  const [couple, setCouple] = usePersistentState("long.couple", DEFAULTS.longevity.couple);
  const [ageB, setAgeB] = usePersistentState("long.ageB", DEFAULTS.longevity.ageB);
  const [sexB, setSexB] = usePersistentState<Sex>("long.sexB", DEFAULTS.longevity.sexB);
  const [longevityAdj, setLongevityAdj] = usePersistentState("long.longevityAdj", DEFAULTS.longevity.longevityAdj);
  const [startingBalance, setStartingBalance] = usePersistentState("long.startingBalance", DEFAULTS.longevity.startingBalance);
  const [annualSpend, setAnnualSpend] = usePersistentState("long.annualSpend", DEFAULTS.longevity.annualSpend);
  const [realReturn, setRealReturn] = usePersistentState("long.realReturn", DEFAULTS.longevity.realReturn);
  const [vol, setVol] = usePersistentState("long.vol", DEFAULTS.longevity.vol);
  const [survivorSpend, setSurvivorSpend] = usePersistentState("long.survivorSpend", DEFAULTS.longevity.survivorSpend);
  const [nSims, setNSims] = usePersistentState("long.nSims", DEFAULTS.longevity.nSims);

  const [data, setData] = useState<LongevityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();
  const c = useChartColors();
  const history = useTabHistory("longevity");

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "beginningValue") setStartingBalance(value);
      else if (key === "nSims") setNSims(value);
    }, [setStartingBalance, setNSims])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("longevity", nSims * 40, "Simulating lifespans");
    try {
      const res = await fetch("/api/simulate/longevity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageA, sexA, couple, ageB, sexB, longevityAdj, startingBalance, annualSpend,
          realReturn, vol, survivorSpend, nSims, seed: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      const d = json as LongevityResult;
      setData(d);
      const tail95 = d.tail.find((t) => t.age === 95);
      history.add({
        label: couple
          ? `Couple · ${ageA}/${ageB} · ${formatCompact(startingBalance)}`
          : `${sexA} ${ageA} · ${formatCompact(startingBalance)}`,
        inputs: { ageA, sexA, couple, ageB, sexB, longevityAdj, startingBalance, annualSpend, realReturn, vol, survivorSpend, nSims },
        metrics: [
          { label: "Outlive money", value: formatPercent(d.ruinMortality) },
          { label: couple ? "Survivor at 95" : "Alive at 95", value: formatPercent((couple ? tail95?.either : tail95?.a) ?? 0) },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [ageA, sexA, couple, ageB, sexB, longevityAdj, startingBalance, annualSpend, realReturn, vol, survivorSpend, nSims, progress, history]);

  useAutoRun(run);

  const restore = (inp: Record<string, unknown>) => {
    const set = (k: string, fn: (v: number) => void) => {
      if (typeof inp[k] === "number") fn(inp[k] as number);
    };
    set("ageA", setAgeA);
    set("ageB", setAgeB);
    set("longevityAdj", setLongevityAdj);
    set("startingBalance", setStartingBalance);
    set("annualSpend", setAnnualSpend);
    set("realReturn", setRealReturn);
    set("vol", setVol);
    set("survivorSpend", setSurvivorSpend);
    set("nSims", setNSims);
    if (inp.sexA === "male" || inp.sexA === "female") setSexA(inp.sexA);
    if (inp.sexB === "male" || inp.sexB === "female") setSexB(inp.sexB);
    if (typeof inp.couple === "boolean") setCouple(inp.couple);
  };

  const survivalRows = data
    ? data.ages.map((age, i) => ({
        age,
        a: data.survivalA[i] * 100,
        b: data.survivalB ? data.survivalB[i] * 100 : undefined,
        either: data.survivalEither ? data.survivalEither[i] * 100 : undefined,
      }))
    : [];

  const planRows = data
    ? data.planHist.counts.map((count, i) => ({
        year: (data.planHist.edges[i] + data.planHist.edges[i + 1]) / 2,
        count,
      }))
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Who</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-sm text-slate-200">Person A age <InfoTip term="mortalityTable" /></span>
            <SexToggle value={sexA} onChange={setSexA} />
          </div>
          <Field label="Age" info="mortalityTable" value={ageA} onChange={(v) => setAgeA(Math.round(v))} min={40} max={90} step={1} display={`${ageA}`} />

          <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-200">Plan for a couple <InfoTip term="jointLife" /></span>
            <button
              type="button"
              role="switch"
              aria-checked={couple}
              aria-label="Plan for a couple"
              onClick={() => setCouple(!couple)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${couple ? "bg-accent" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${couple ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </label>

          {couple ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-200">Person B age</span>
                <SexToggle value={sexB} onChange={setSexB} />
              </div>
              <Field label="Age" info="jointLife" value={ageB} onChange={(v) => setAgeB(Math.round(v))} min={40} max={90} step={1} display={`${ageB}`} />
              <Field label="Survivor spending" info="survivorSpend" value={survivorSpend} onChange={setSurvivorSpend} min={0.5} max={1} step={0.05} display={formatPercent(survivorSpend)} hint="spend after the first death" />
            </>
          ) : null}

          <Field label="Longevity adjustment" info="mortalityAdj" value={longevityAdj} onChange={(v) => setLongevityAdj(Math.round(v))} min={-6} max={8} step={1} display={`${longevityAdj >= 0 ? "+" : ""}${longevityAdj} yr`} hint="health / family history tilt" />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Portfolio &amp; spending</h3>
        <div className="space-y-4">
          <Field label="Balance" info="beginningValue" value={startingBalance} onChange={setStartingBalance} min={100_000} max={10_000_000} step={10_000} display={formatCurrency(startingBalance)} sharedKey="beginningValue" />
          <Field label="Annual spending" info="withdrawal" value={annualSpend} onChange={setAnnualSpend} min={10_000} max={500_000} step={2500} display={formatCurrency(annualSpend)} hint={`${formatPercent(annualSpend / startingBalance)} of balance`} />
          <Field label="Real return" info="real" value={realReturn} onChange={setRealReturn} min={-0.02} max={0.08} step={0.005} display={formatPercent(realReturn)} hint="after inflation" />
          <Field label="Volatility" info="sigma" value={vol} onChange={setVol} min={0} max={0.3} step={0.005} display={formatPercent(vol)} />
          <Field label="Simulations" info="nSims" value={nSims} onChange={(v) => setNSims(Math.round(v))} min={1000} max={50_000} step={1000} display={nSims.toLocaleString()} sharedKey="nSims" />
        </div>

        <button onClick={run} disabled={loading} className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Simulating…" : "Run longevity simulation"}
        </button>
        <p className="mt-3 text-[11px] text-muted">
          Lifespans are drawn from a Gompertz mortality curve (an educational
          approximation, not a specific actuarial table). Spending is in today&apos;s $.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">
                Chance of outliving your money <InfoTip term="outliveMoney" />
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className={`text-4xl font-bold tabular-nums ${data.ruinMortality <= 0.1 ? "text-good" : data.ruinMortality <= 0.25 ? "text-accent" : "text-bad"}`}>
                  {formatPercent(data.ruinMortality)}
                </span>
                <span className="pb-1 text-sm text-muted">
                  money runs out before {data.couple ? "the second death" : "death"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {data.couple ? "The last survivor" : "This person"} lives to a median age of{" "}
                <span className="font-semibold text-white">{Math.round(data.medianLastDeathAge)}</span>, and there&apos;s a{" "}
                <span className="font-semibold text-white">
                  {formatPercent((data.couple ? data.tail.find((t) => t.age === 95)?.either : data.tail.find((t) => t.age === 95)?.a) ?? 0)}
                </span>{" "}
                chance {data.couple ? "a survivor is" : "of being"} still alive at 95 — the tail a fixed horizon misses.
                Plan length runs {Math.round(data.planP10Years)}–{Math.round(data.planP90Years)} years (median {Math.round(data.planMedianYears)}).
              </p>
            </div>

            {/* Survival tail table */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Chance of reaching each age <InfoTip term="longevity" /></h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Age</th>
                      <th className="pb-2 text-right font-medium">Person A</th>
                      {data.couple ? <th className="pb-2 text-right font-medium">Person B</th> : null}
                      {data.couple ? <th className="pb-2 text-right font-medium">Either alive</th> : null}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.tail.map((t) => (
                      <tr key={t.age} className="border-t border-line/50">
                        <td className="py-1.5 text-slate-200">{t.age}</td>
                        <td className="py-1.5 text-right">{formatPercent(t.a)}</td>
                        {data.couple ? <td className="py-1.5 text-right">{formatPercent(t.b ?? 0)}</td> : null}
                        {data.couple ? <td className="py-1.5 text-right text-accent2">{formatPercent(t.either ?? 0)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Survival curves */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Survival probability by age</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={survivalRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="age" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Age", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Age ${v}`} formatter={(value: number, key: string) => [`${value.toFixed(1)}%`, key === "a" ? "Person A" : key === "b" ? "Person B" : "Either alive"]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} payload={[
                      { value: "Person A", type: "line" as const, color: A_COLOR, id: "a" },
                      ...(data.couple ? [
                        { value: "Person B", type: "line" as const, color: B_COLOR, id: "b" },
                        { value: "Either alive", type: "line" as const, color: EITHER_COLOR, id: "either" },
                      ] : []),
                    ]} />
                    <ReferenceLine x={95} stroke={c.muted} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="a" stroke={A_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" />
                    {data.couple ? <Line type="monotone" dataKey="b" stroke={B_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" /> : null}
                    {data.couple ? <Line type="monotone" dataKey="either" stroke={EITHER_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} legendType="none" /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plan-length distribution */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">
                How many years the plan must last {data.couple ? "(until the second death)" : "(until death)"}
              </h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" stroke={c.axis} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v)}`} label={{ value: "Years from now", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip cursor={{ fill: c.muted, fillOpacity: 0.08 }} contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `≈ ${Math.round(v)} years`} formatter={(v: number) => [`${v} paths`, "Count"]} />
                    <ReferenceLine x={data.planMedianYears} stroke={c.text} strokeWidth={1.5} label={{ value: "median", fill: c.text, fontSize: 10, position: "top" }} />
                    <Bar dataKey="count" fill={EITHER_COLOR} fillOpacity={0.85} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Simulating lifespans…" : "Run a longevity simulation to see results."}
          </div>
        )}

        <TabHistoryPanel history={history} onRestore={restore} />
      </section>
    </div>
  );
}
