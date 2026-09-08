"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import Field from "@/components/Field";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import type { TornadoResult, Metric, Fmt } from "@/lib/sensitivity";

type Model = "gbm" | "retirement";

const GBM_METRICS: { id: Metric; label: string }[] = [
  { id: "median", label: "Median outcome" },
  { id: "p5", label: "P5 (worst 5%)" },
  { id: "probLoss", label: "Prob. of loss" },
];
const RET_METRICS: { id: Metric; label: string }[] = [
  { id: "successRate", label: "Success rate" },
  { id: "median", label: "Median outcome" },
  { id: "p5", label: "P5 (worst 5%)" },
];

function fmtVal(v: number, f: Fmt): string {
  if (f === "percent") return formatPercent(v);
  if (f === "currency") return formatCurrency(v);
  return v.toLocaleString();
}

export default function Sensitivity() {
  const [model, setModel] = useState<Model>("gbm");
  const [metric, setMetric] = useState<Metric>("median");
  const [variationPct, setVariationPct] = useState(0.2);

  const [gbm, setGbm] = useState({ beginningValue: 100_000, mu: 0.07, sigma: 0.15, years: 10 });
  const [ret, setRet] = useState({
    startingBalance: 100_000,
    annualContribution: 15_000,
    yearsToRetire: 25,
    retirementYears: 30,
    annualWithdrawal: 60_000,
    meanReturn: 0.06,
    stdReturn: 0.12,
    inflation: 0.025,
  });

  const [data, setData] = useState<TornadoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setModelAndMetric = useCallback((m: Model) => {
    setModel(m);
    setMetric(m === "gbm" ? "median" : "successRate");
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate/sensitivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          metric,
          variationPct,
          nSims: 4000,
          inputs: model === "gbm" ? gbm : ret,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sensitivity analysis failed");
      setData(json as TornadoResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sensitivity analysis failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [model, metric, variationPct, gbm, ret]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartRows = useMemo(() => {
    if (!data) return [];
    // API rows are sorted by swing desc; recharts vertical layout renders the
    // first item at the top, so keep that order to put the widest bar on top.
    return data.rows
      .map((r) => ({
        label: r.label,
        range: [Math.min(r.lowOut, r.highOut), Math.max(r.lowOut, r.highOut)] as [number, number],
        up: r.highOut >= r.lowOut,
        row: r,
      }));
  }, [data]);

  const metrics = model === "gbm" ? GBM_METRICS : RET_METRICS;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 inline-flex rounded-lg border border-line bg-panel2 p-1">
          <button onClick={() => setModelAndMetric("gbm")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${model === "gbm" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"}`}>Portfolio</button>
          <button onClick={() => setModelAndMetric("retirement")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${model === "retirement" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"}`}>Retirement</button>
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Output metric</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {metrics.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                metric === m.id ? "border-accent2 bg-accent2/15 text-accent2" : "border-line text-muted hover:text-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <Field
            label="Vary each input by ±"
            value={variationPct}
            onChange={setVariationPct}
            min={0.05}
            max={0.5}
            step={0.05}
            display={formatPercent(variationPct, 0)}
            hint="one-at-a-time, around the base case"
          />
        </div>

        <div className="my-4 h-px bg-line" />

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Base case</h3>
        {model === "gbm" ? (
          <div className="space-y-4">
            <Field label="Beginning value" value={gbm.beginningValue} onChange={(v) => setGbm({ ...gbm, beginningValue: v })} min={1000} max={5_000_000} step={1000} display={formatCurrency(gbm.beginningValue)} />
            <Field label="Expected return (μ)" value={gbm.mu} onChange={(v) => setGbm({ ...gbm, mu: v })} min={-0.05} max={0.2} step={0.005} display={formatPercent(gbm.mu)} />
            <Field label="Volatility (σ)" value={gbm.sigma} onChange={(v) => setGbm({ ...gbm, sigma: v })} min={0.01} max={0.6} step={0.005} display={formatPercent(gbm.sigma)} />
            <Field label="Time horizon" value={gbm.years} onChange={(v) => setGbm({ ...gbm, years: v })} min={1} max={40} step={1} display={`${gbm.years} yr`} />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Starting balance" value={ret.startingBalance} onChange={(v) => setRet({ ...ret, startingBalance: v })} min={0} max={2_000_000} step={5000} display={formatCurrency(ret.startingBalance)} />
            <Field label="Annual contribution" value={ret.annualContribution} onChange={(v) => setRet({ ...ret, annualContribution: v })} min={0} max={100_000} step={1000} display={formatCurrency(ret.annualContribution)} />
            <Field label="Years to retirement" value={ret.yearsToRetire} onChange={(v) => setRet({ ...ret, yearsToRetire: v })} min={0} max={50} step={1} display={`${ret.yearsToRetire} yr`} />
            <Field label="Years in retirement" value={ret.retirementYears} onChange={(v) => setRet({ ...ret, retirementYears: v })} min={1} max={50} step={1} display={`${ret.retirementYears} yr`} />
            <Field label="Annual withdrawal" value={ret.annualWithdrawal} onChange={(v) => setRet({ ...ret, annualWithdrawal: v })} min={0} max={300_000} step={2500} display={formatCurrency(ret.annualWithdrawal)} />
            <Field label="Expected return" value={ret.meanReturn} onChange={(v) => setRet({ ...ret, meanReturn: v })} min={-0.02} max={0.15} step={0.005} display={formatPercent(ret.meanReturn)} />
            <Field label="Return volatility" value={ret.stdReturn} onChange={(v) => setRet({ ...ret, stdReturn: v })} min={0} max={0.4} step={0.005} display={formatPercent(ret.stdReturn)} />
            <Field label="Inflation" value={ret.inflation} onChange={(v) => setRet({ ...ret, inflation: v })} min={0} max={0.1} step={0.0025} display={formatPercent(ret.inflation)} />
          </div>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing…" : "Run sensitivity"}
        </button>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-line bg-panel p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  Tornado — sensitivity of{" "}
                  <span className="text-accent2">{metrics.find((m) => m.id === metric)?.label}</span>
                </h3>
                <span className="text-xs text-muted">
                  base {fmtVal(data.baseMetric, data.metricFormat)} · ±{formatPercent(variationPct, 0)} each · {data.nSims.toLocaleString()} sims
                </span>
              </div>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartRows} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#8ea1c0"
                      tick={{ fontSize: 11 }}
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v: number) => (data.metricFormat === "percent" ? formatPercent(v, 0) : formatCompact(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      stroke="#8ea1c0"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip
                      cursor={{ fill: "#ffffff08" }}
                      contentStyle={{ background: "#0e1626", border: "1px solid #1e2a44", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#8ea1c0" }}
                      formatter={(_v, _n, item: { payload?: { row?: import("@/lib/sensitivity").TornadoRow } }) => {
                        const r = item?.payload?.row;
                        if (!r) return ["", ""] as [string, string];
                        return [
                          `${fmtVal(r.lowInput, r.inputFormat)} → ${fmtVal(r.lowOut, data.metricFormat)}   |   ${fmtVal(r.highInput, r.inputFormat)} → ${fmtVal(r.highOut, data.metricFormat)}`,
                          "low → out | high → out",
                        ] as [string, string];
                      }}
                    />
                    <ReferenceLine x={data.baseMetric} stroke="#e6edf7" strokeWidth={1.5} />
                    <Bar dataKey="range" isAnimationActive={false} radius={2}>
                      {chartRows.map((r, i) => (
                        <Cell key={i} fill={r.up ? "#38bdf8" : "#f59e0b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#38bdf8" }} />higher input → higher metric</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#f59e0b" }} />higher input → lower metric</span>
                <span><span className="mr-1 inline-block h-3 w-0.5 align-middle" style={{ background: "#e6edf7" }} />base case</span>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">Ranked impact</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Input</th>
                      <th className="pb-2 text-right font-medium">Low → metric</th>
                      <th className="pb-2 text-right font-medium">High → metric</th>
                      <th className="pb-2 text-right font-medium">Swing</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.rows.map((r) => (
                      <tr key={r.key} className="border-t border-line/50">
                        <td className="py-1.5 text-slate-200">{r.label}</td>
                        <td className="py-1.5 text-right text-muted">
                          {fmtVal(r.lowInput, r.inputFormat)} → {fmtVal(r.lowOut, data.metricFormat)}
                        </td>
                        <td className="py-1.5 text-right text-muted">
                          {fmtVal(r.highInput, r.inputFormat)} → {fmtVal(r.highOut, data.metricFormat)}
                        </td>
                        <td className="py-1.5 text-right font-semibold text-accent2">
                          {fmtVal(r.swing, data.metricFormat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
            {loading ? "Running sensitivity analysis…" : "Run a sensitivity analysis to see the tornado."}
          </div>
        )}
      </section>
    </div>
  );
}
