"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FanChart from "@/components/FanChart";
import Histogram from "@/components/Histogram";
import StatCards from "@/components/StatCards";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { SimulationResponse } from "@/lib/types";

interface RosterAsset {
  id: string;
  name: string;
  mu: number;
  sigma: number;
  weight: number;
  include: boolean;
}

const DEFAULT_ROSTER: RosterAsset[] = [
  { id: "eq", name: "US Equities", mu: 0.08, sigma: 0.16, weight: 0.4, include: true },
  { id: "intl", name: "Intl Equities", mu: 0.07, sigma: 0.18, weight: 0.2, include: true },
  { id: "bond", name: "Bonds", mu: 0.03, sigma: 0.06, weight: 0.25, include: true },
  { id: "gold", name: "Gold", mu: 0.04, sigma: 0.15, weight: 0.1, include: true },
  { id: "reit", name: "Real Estate", mu: 0.06, sigma: 0.19, weight: 0.05, include: true },
];

// Default pairwise correlations (symmetric, 5x5 in roster order).
const DEFAULT_CORR: number[][] = [
  [1, 0.85, -0.1, 0.1, 0.6],
  [0.85, 1, -0.05, 0.15, 0.55],
  [-0.1, -0.05, 1, 0.2, 0.2],
  [0.1, 0.15, 0.2, 1, 0.1],
  [0.6, 0.55, 0.2, 0.1, 1],
];

function NumInput({
  value,
  onChange,
  step = 0.5,
  suffix = "%",
  width = "w-16",
  scale = 100,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  width?: string;
  scale?: number;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="number"
        step={step}
        value={Number((value * scale).toFixed(2))}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v / scale : 0);
        }}
        className={`${width} rounded border border-line bg-panel2 px-1.5 py-1 text-right text-xs tabular-nums text-slate-100 focus:border-accent focus:outline-none`}
      />
      {suffix ? <span className="text-[10px] text-muted">{suffix}</span> : null}
    </span>
  );
}

export default function MultiAsset() {
  const [roster, setRoster] = useState<RosterAsset[]>(DEFAULT_ROSTER);
  const [corr, setCorr] = useState<number[][]>(DEFAULT_CORR.map((r) => [...r]));
  const [beginningValue, setBeginningValue] = useState(100_000);
  const [years, setYears] = useState(20);
  const [nSims, setNSims] = useState(10_000);
  const [rebalance, setRebalance] = useState(true);

  const [data, setData] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const included = useMemo(
    () => roster.map((a, i) => ({ a, i })).filter(({ a }) => a.include),
    [roster]
  );
  const weightSum = included.reduce((s, { a }) => s + a.weight, 0);

  const updateAsset = (idx: number, patch: Partial<RosterAsset>) =>
    setRoster((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const updateCorr = (i: number, j: number, v: number) => {
    const val = Math.min(1, Math.max(-1, v));
    setCorr((prev) => {
      const next = prev.map((r) => [...r]);
      next[i][j] = val;
      next[j][i] = val;
      return next;
    });
  };

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idxs = roster.map((a, i) => ({ a, i })).filter(({ a }) => a.include);
      const assets = idxs.map(({ a }) => ({
        id: a.id,
        name: a.name,
        mu: a.mu,
        sigma: a.sigma,
        weight: a.weight,
      }));
      const subCorr = idxs.map(({ i }) => idxs.map(({ i: j }) => corr[i][j]));
      const res = await fetch("/api/simulate/multiasset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, corr: subCorr, beginningValue, years, nSims, seed: 2026, rebalance }),
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
  }, [roster, corr, beginningValue, years, nSims, rebalance]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Asset roster */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Assets</h3>
          <span className={`text-xs tabular-nums ${Math.abs(weightSum - 1) < 0.001 ? "text-good" : "text-accent"}`}>
            weights sum to {formatPercent(weightSum)}{Math.abs(weightSum - 1) < 0.001 ? "" : " (auto-normalized)"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Include</th>
                <th className="pb-2 font-medium">Asset</th>
                <th className="pb-2 text-right font-medium">Weight</th>
                <th className="pb-2 text-right font-medium">Return μ</th>
                <th className="pb-2 text-right font-medium">Volatility σ</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((a, idx) => (
                <tr key={a.id} className={`border-t border-line/50 ${a.include ? "" : "opacity-40"}`}>
                  <td className="py-1.5">
                    <input type="checkbox" checked={a.include} onChange={(e) => updateAsset(idx, { include: e.target.checked })} className="h-4 w-4 accent-[#f59e0b]" />
                  </td>
                  <td className="py-1.5 text-slate-200">{a.name}</td>
                  <td className="py-1.5 text-right"><NumInput value={a.weight} onChange={(v) => updateAsset(idx, { weight: v })} step={1} /></td>
                  <td className="py-1.5 text-right"><NumInput value={a.mu} onChange={(v) => updateAsset(idx, { mu: v })} step={0.5} /></td>
                  <td className="py-1.5 text-right"><NumInput value={a.sigma} onChange={(v) => updateAsset(idx, { sigma: v })} step={0.5} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Correlation matrix */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Correlation matrix</h3>
          {included.length < 2 ? (
            <p className="text-sm text-muted">Include at least two assets to set correlations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="p-1"></th>
                    {included.map(({ a }) => (
                      <th key={a.id} className="p-1 text-[10px] font-medium text-muted">{a.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {included.map(({ a: rowA, i: ri }) => (
                    <tr key={rowA.id}>
                      <td className="p-1 text-[10px] font-medium text-muted">{rowA.name.split(" ")[0]}</td>
                      {included.map(({ i: ci }) => (
                        <td key={ci} className="p-1 text-center">
                          {ri === ci ? (
                            <span className="text-muted">1.00</span>
                          ) : ci > ri ? (
                            <input
                              type="number"
                              step={0.05}
                              min={-1}
                              max={1}
                              value={Number(corr[ri][ci].toFixed(2))}
                              onChange={(e) => updateCorr(ri, ci, parseFloat(e.target.value))}
                              className="w-14 rounded border border-line bg-panel2 px-1 py-0.5 text-right tabular-nums text-slate-100 focus:border-accent focus:outline-none"
                            />
                          ) : (
                            <span className="tabular-nums text-slate-400">{corr[ri][ci].toFixed(2)}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Portfolio settings */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Portfolio</h3>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between">
              <span className="text-slate-200">Beginning value</span>
              <NumInput value={beginningValue} onChange={setBeginningValue} scale={1} step={1000} suffix="" width="w-28" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-slate-200">Time horizon (years)</span>
              <NumInput value={years} onChange={(v) => setYears(Math.max(1, Math.round(v)))} scale={1} step={1} suffix="" width="w-20" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-slate-200">Simulations</span>
              <NumInput value={nSims} onChange={(v) => setNSims(Math.max(500, Math.round(v)))} scale={1} step={1000} suffix="" width="w-24" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-slate-200">Rebalance annually</span>
              <input type="checkbox" checked={rebalance} onChange={(e) => setRebalance(e.target.checked)} className="h-4 w-4 accent-[#f59e0b]" />
            </label>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Simulating…" : "Run portfolio simulation"}
          </button>
        </section>
      </div>

      {/* Results */}
      {error ? <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div> : null}

      {data ? (
        <>
          <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
            <div className="text-xs uppercase tracking-wide text-muted">Diversification</div>
            <div className="mt-1 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-bold tabular-nums text-good">
                −{formatPercent(((data.meta.diversificationBenefit as number) ?? 0))}
              </span>
              <span className="pb-1 text-sm text-muted">
                volatility saved vs. holding these assets in lockstep
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Blended expected return <span className="font-semibold text-white">{formatPercent((data.meta.expectedReturn as number) ?? 0)}</span>.
              Diversified portfolio volatility <span className="font-semibold text-white">{formatPercent((data.meta.portfolioVol as number) ?? 0)}</span>,
              versus <span className="font-semibold text-white">{formatPercent((data.meta.undiversifiedVol as number) ?? 0)}</span> if the assets moved together —
              correlations below 1 do the work. {(data.meta.rebalance as boolean) ? "Rebalanced annually." : "Buy-and-hold (no rebalancing)."}
            </p>
          </div>

          <StatCards data={data} />

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Portfolio value: trajectories &amp; percentile bands</h3>
            <FanChart data={data} />
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Distribution of terminal portfolio value</h3>
            <Histogram data={data} />
          </div>
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
          {loading ? "Simulating correlated portfolio…" : "Run a simulation to see results."}
        </div>
      )}
    </div>
  );
}
