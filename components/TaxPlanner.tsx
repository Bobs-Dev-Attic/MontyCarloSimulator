"use client";

import { useCallback, useState } from "react";
import { DEFAULTS } from "@/lib/defaults";
import {
  AreaChart,
  Area,
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
import { exportToExcel } from "@/lib/excelExport";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { TaxResult } from "@/lib/tax";

const TAXABLE_COLOR = "#38bdf8";
const DEFERRED_COLOR = "#f59e0b";
const ROTH_COLOR = "#34d399";
const TAX_COLOR = "#f87171";
const RMD_COLOR = "#a78bfa";
const CONV_COLOR = "#34d399";

// Bracket tops (2024) offered as Roth-conversion fill targets.
const RATE_OPTIONS = [
  { rate: 0, label: "Off" },
  { rate: 0.1, label: "10%" },
  { rate: 0.12, label: "12%" },
  { rate: 0.22, label: "22%" },
  { rate: 0.24, label: "24%" },
  { rate: 0.32, label: "32%" },
];

export default function TaxPlanner() {
  const [startAge, setStartAge] = usePersistentState("tax.startAge", DEFAULTS.tax.startAge);
  const [filing, setFiling] = usePersistentState<"single" | "mfj">("tax.filing", DEFAULTS.tax.filing);
  const [years, setYears] = usePersistentState("tax.years", DEFAULTS.tax.years);
  const [taxable, setTaxable] = usePersistentState("tax.taxable", DEFAULTS.tax.taxable);
  const [taxableBasisPct, setTaxableBasisPct] = usePersistentState("tax.taxableBasisPct", DEFAULTS.tax.taxableBasisPct);
  const [deferred, setDeferred] = usePersistentState("tax.deferred", DEFAULTS.tax.deferred);
  const [roth, setRoth] = usePersistentState("tax.roth", DEFAULTS.tax.roth);
  const [annualSpend, setAnnualSpend] = usePersistentState("tax.annualSpend", DEFAULTS.tax.annualSpend);
  const [otherIncome, setOtherIncome] = usePersistentState("tax.otherIncome", DEFAULTS.tax.otherIncome);
  const [nominalReturn, setNominalReturn] = usePersistentState("tax.nominalReturn", DEFAULTS.tax.nominalReturn);
  const [inflation, setInflation] = usePersistentState("tax.inflation", DEFAULTS.tax.inflation);
  const [ltcgRate, setLtcgRate] = usePersistentState("tax.ltcgRate", DEFAULTS.tax.ltcgRate);
  const [conversionTopRate, setConversionTopRate] = usePersistentState("tax.conversionTopRate", DEFAULTS.tax.conversionTopRate);
  const [terminalTaxRate, setTerminalTaxRate] = usePersistentState("tax.terminalTaxRate", DEFAULTS.tax.terminalTaxRate);

  const [data, setData] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const progress = useProgress();
  const c = useChartColors();
  const history = useTabHistory("tax");

  useApplyAllHandler(
    useCallback((key, value) => {
      if (key === "years") setYears(Math.round(value));
    }, [setYears])
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tracker = progress.track("tax", years * 4000, "Projecting taxes & conversions");
    try {
      const res = await fetch("/api/simulate/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAge, filing, years, taxable, taxableBasisPct, deferred, roth,
          annualSpend, otherIncome, nominalReturn, inflation, ltcgRate,
          conversionTopRate, terminalTaxRate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      const d = json as TaxResult;
      setData(d);
      const topLabel = RATE_OPTIONS.find((o) => o.rate === conversionTopRate)?.label ?? "";
      history.add({
        label: `Age ${startAge} · ${filing === "mfj" ? "MFJ" : "Single"} · fill to ${topLabel}`,
        inputs: { startAge, filing, years, taxable, taxableBasisPct, deferred, roth, annualSpend, otherIncome, nominalReturn, inflation, ltcgRate, conversionTopRate, terminalTaxRate },
        metrics: [
          { label: "After-tax gain", value: formatCurrency(d.afterTaxGain) },
          { label: "Lifetime tax saved", value: formatCurrency(d.taxSaved) },
          { label: "Converted", value: formatCurrency(d.smart.totalConversions) },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setData(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [startAge, filing, years, taxable, taxableBasisPct, deferred, roth, annualSpend, otherIncome, nominalReturn, inflation, ltcgRate, conversionTopRate, terminalTaxRate, progress, history]);

  useAutoRun(run);

  const doExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      await exportToExcel({
        kind: "tax",
        inputs: {
          startAge, filing, years, taxable, taxableBasisPct, deferred, roth,
          annualSpend, otherIncome, nominalReturn, inflation, ltcgRate,
          conversionTopRate, terminalTaxRate,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [startAge, filing, years, taxable, taxableBasisPct, deferred, roth, annualSpend, otherIncome, nominalReturn, inflation, ltcgRate, conversionTopRate, terminalTaxRate]);

  const restore = (inp: Record<string, unknown>) => {
    const setN = (k: string, fn: (v: number) => void) => {
      if (typeof inp[k] === "number") fn(inp[k] as number);
    };
    setN("startAge", setStartAge);
    if (inp.filing === "single" || inp.filing === "mfj") setFiling(inp.filing);
    setN("years", setYears);
    setN("taxable", setTaxable);
    setN("taxableBasisPct", setTaxableBasisPct);
    setN("deferred", setDeferred);
    setN("roth", setRoth);
    setN("annualSpend", setAnnualSpend);
    setN("otherIncome", setOtherIncome);
    setN("nominalReturn", setNominalReturn);
    setN("inflation", setInflation);
    setN("ltcgRate", setLtcgRate);
    setN("conversionTopRate", setConversionTopRate);
    setN("terminalTaxRate", setTerminalTaxRate);
  };

  const balanceRows = data
    ? data.smart.rows.map((r) => ({
        age: r.age,
        Taxable: r.taxable,
        "Tax-deferred": r.deferred,
        Roth: r.roth,
      }))
    : [];

  const flowRows = data
    ? data.smart.rows.map((r) => ({
        age: r.age,
        Tax: r.tax,
        RMD: r.rmd,
        Conversion: r.conversion,
      }))
    : [];

  const strategies = data ? [data.naive, data.smart] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Household</h2>
        <div className="space-y-4">
          <Field label="Current age" info="rmd" value={startAge} onChange={(v) => setStartAge(Math.round(v))} min={40} max={80} step={1} display={`${startAge}`} />
          <div>
            <label className="text-sm text-slate-200">Filing status</label>
            <div className="mt-2 inline-flex rounded-lg border border-line bg-panel2 p-1">
              <button onClick={() => setFiling("single")} className={`rounded-md px-3 py-1 text-xs font-medium transition ${filing === "single" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"}`}>Single</button>
              <button onClick={() => setFiling("mfj")} className={`rounded-md px-3 py-1 text-xs font-medium transition ${filing === "mfj" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"}`}>Married (MFJ)</button>
            </div>
          </div>
          <Field label="Projection years" info="years" value={years} onChange={(v) => setYears(Math.round(v))} min={5} max={45} step={1} display={`${years} yr`} sharedKey="years" />
          <Field label="Annual spending" info="withdrawal" value={annualSpend} onChange={setAnnualSpend} min={20_000} max={400_000} step={5000} display={formatCurrency(annualSpend)} hint="after-tax, today's $" />
          <Field label="Other taxable income" info="assetLocation" value={otherIncome} onChange={setOtherIncome} min={0} max={200_000} step={2500} display={formatCurrency(otherIncome)} hint="pension, wages (yr 1, today's $)" />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Accounts <InfoTip term="assetLocation" /></h3>
        <div className="space-y-4">
          <Field label="Taxable brokerage" info="assetLocation" value={taxable} onChange={setTaxable} min={0} max={10_000_000} step={25_000} display={formatCurrency(taxable)} />
          <Field label="Taxable cost basis" info="ltcg" value={taxableBasisPct} onChange={setTaxableBasisPct} min={0} max={1} step={0.05} display={formatPercent(taxableBasisPct)} hint="fraction of brokerage that is basis" />
          <Field label="Tax-deferred (IRA/401k)" info="rmd" value={deferred} onChange={setDeferred} min={0} max={10_000_000} step={25_000} display={formatCurrency(deferred)} />
          <Field label="Tax-free (Roth)" info="rothConversion" value={roth} onChange={setRoth} min={0} max={10_000_000} step={25_000} display={formatCurrency(roth)} />
        </div>

        <div className="my-5 h-px bg-line" />
        <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">Assumptions & tax <InfoTip term="taxBrackets" /></h3>
        <div className="space-y-4">
          <Field label="Nominal return" info="mu" value={nominalReturn} onChange={setNominalReturn} min={0} max={0.12} step={0.005} display={formatPercent(nominalReturn)} />
          <Field label="Inflation" info="inflation" value={inflation} onChange={setInflation} min={0} max={0.08} step={0.0025} display={formatPercent(inflation)} hint="also indexes the brackets" />
          <Field label="Capital gains rate" info="ltcg" value={ltcgRate} onChange={setLtcgRate} min={0} max={0.3} step={0.01} display={formatPercent(ltcgRate)} />
          <div>
            <label className="flex items-center gap-1 text-sm text-slate-200">Convert Roth up to <InfoTip term="rothConversion" /></label>
            <div className="mt-2 flex flex-wrap gap-1">
              {RATE_OPTIONS.map((o) => (
                <button key={o.rate} onClick={() => setConversionTopRate(o.rate)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${conversionTopRate === o.rate ? "bg-accent text-ink" : "border border-line bg-panel2 text-muted hover:text-slate-200"}`}>{o.label}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Fill ordinary income to the top of this bracket with conversions each year.</p>
          </div>
          <Field label="Terminal tax rate" info="assetLocation" value={terminalTaxRate} onChange={setTerminalTaxRate} min={0} max={0.4} step={0.01} display={formatPercent(terminalTaxRate)} hint="rate to value leftover IRA (heirs)" />
        </div>

        <button onClick={run} disabled={loading} className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Projecting…" : "Run tax projection"}
        </button>
        <button onClick={doExport} disabled={exporting} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2 text-sm font-medium text-slate-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exporting ? "Building workbook…" : "Export to Excel"}
        </button>
        <p className="mt-1.5 text-[11px] text-muted">Excel export uses live formulas — edit the assumptions and it recomputes.</p>
        <p className="mt-3 text-[11px] text-muted">
          Deterministic year-by-year projection at the assumed return. Compares a
          naive drawdown against a plan that fills a target bracket with Roth
          conversions. 2024 federal brackets, indexed to inflation. Educational
          only — not tax advice.
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted">
                What tax-smart conversions are worth <InfoTip term="rothConversion" />
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className={`text-4xl font-bold tabular-nums ${data.afterTaxGain >= 0 ? "text-good" : "text-bad"}`}>
                  {data.afterTaxGain >= 0 ? "+" : ""}{formatCurrency(data.afterTaxGain)}
                </span>
                <span className="pb-1 text-sm text-muted">more after-tax wealth at the end of the plan</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Filling the {RATE_OPTIONS.find((o) => o.rate === conversionTopRate)?.label ?? "target"} bracket with Roth
                conversions moves{" "}
                <span className="font-semibold text-white">{formatCurrency(data.smart.totalConversions)}</span> out of the
                tax-deferred account over the plan, changing lifetime taxes by{" "}
                <span className={`font-semibold ${data.taxSaved >= 0 ? "text-good" : "text-bad"}`}>
                  {data.taxSaved >= 0 ? formatCurrency(data.taxSaved) + " saved" : formatCurrency(-data.taxSaved) + " more"}
                </span>{" "}
                and shrinking future RMDs. After-tax terminal wealth counts leftover IRA at the terminal rate and
                embedded gains at the capital-gains rate.
              </p>
            </div>

            {/* Strategy comparison table */}
            <div className="overflow-x-auto rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Strategy comparison <InfoTip term="assetLocation" /></h3>
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Metric</th>
                    {strategies.map((s) => (
                      <th key={s.id} className="py-2 pr-3 text-right font-medium">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[
                    { k: "After-tax terminal wealth", f: (s: typeof strategies[number]) => formatCurrency(s.terminalAfterTax) },
                    { k: "Nominal terminal wealth", f: (s: typeof strategies[number]) => formatCurrency(s.terminalNominal) },
                    { k: "Lifetime taxes paid", f: (s: typeof strategies[number]) => formatCurrency(s.totalTax) },
                    { k: "Total RMDs", f: (s: typeof strategies[number]) => formatCurrency(s.totalRMD) },
                    { k: "Total Roth conversions", f: (s: typeof strategies[number]) => formatCurrency(s.totalConversions) },
                    { k: "Money runs out", f: (s: typeof strategies[number]) => (s.depletedYear ? `year ${s.depletedYear}` : "never") },
                  ].map((row) => (
                    <tr key={row.k} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-slate-300">{row.k}</td>
                      {strategies.map((s) => (
                        <td key={s.id} className="py-2 pr-3 text-right text-white">{row.f(s)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bucket balances over time (smart strategy) */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Account balances with conversions <InfoTip term="assetLocation" /></h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="age" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Age", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={54} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Age ${v}`} formatter={(value: number, key: string) => [formatCurrency(value), key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="Taxable" stackId="1" stroke={TAXABLE_COLOR} fill={TAXABLE_COLOR} fillOpacity={0.7} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Tax-deferred" stackId="1" stroke={DEFERRED_COLOR} fill={DEFERRED_COLOR} fillOpacity={0.7} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Roth" stackId="1" stroke={ROTH_COLOR} fill={ROTH_COLOR} fillOpacity={0.7} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted">Conversions shift the orange tax-deferred balance into green Roth, lowering future RMDs.</p>
            </div>

            {/* Annual tax / RMD / conversion flows */}
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-200">Annual tax, RMDs & conversions <InfoTip term="rmd" /></h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={flowRows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="age" stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Age", position: "insideBottom", offset: -2, fill: c.axis, fontSize: 11 }} />
                    <YAxis stroke={c.axis} tick={{ fontSize: 11 }} width={54} tickFormatter={(v: number) => formatCompact(v)} />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(v: number) => `Age ${v}`} formatter={(value: number, key: string) => [formatCurrency(value), key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Tax" stroke={TAX_COLOR} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="RMD" stroke={RMD_COLOR} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Conversion" stroke={CONV_COLOR} dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted">Conversions are front-loaded before RMDs begin at 73; smaller deferred balances then mean smaller forced RMDs and lower late-life taxes.</p>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Projecting taxes & conversions…" : "Run a tax projection to see results."}
          </div>
        )}

        <TabHistoryPanel history={history} onRestore={restore} />
      </section>
    </div>
  );
}
