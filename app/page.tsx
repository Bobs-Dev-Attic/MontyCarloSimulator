"use client";

import { useCallback, useEffect, useState } from "react";
import type { SimulationResponse } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import Field from "@/components/Field";
import FanChart from "@/components/FanChart";
import Histogram from "@/components/Histogram";
import StatCards from "@/components/StatCards";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

type Model = "gbm" | "retirement";

interface GbmState {
  beginningValue: number;
  mu: number;
  sigma: number;
  years: number;
  nSims: number;
  seed: number | null;
}

interface RetirementState {
  startingBalance: number;
  annualContribution: number;
  yearsToRetire: number;
  retirementYears: number;
  annualWithdrawal: number;
  meanReturn: number;
  stdReturn: number;
  inflation: number;
  nSims: number;
  seed: number | null;
}

const DEFAULT_GBM: GbmState = {
  beginningValue: 10_000,
  mu: 0.07,
  sigma: 0.15,
  years: 10,
  nSims: 10_000,
  seed: 2026,
};

const DEFAULT_RETIREMENT: RetirementState = {
  startingBalance: 100_000,
  annualContribution: 15_000,
  yearsToRetire: 25,
  retirementYears: 30,
  annualWithdrawal: 60_000,
  meanReturn: 0.06,
  stdReturn: 0.12,
  inflation: 0.025,
  nSims: 10_000,
  seed: 2026,
};

export default function Page() {
  const [model, setModel] = useState<Model>("gbm");
  const [gbm, setGbm] = useState<GbmState>(DEFAULT_GBM);
  const [ret, setRet] = useState<RetirementState>(DEFAULT_RETIREMENT);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const started = performance.now();
    try {
      const endpoint =
        model === "gbm" ? "/api/simulate/gbm" : "/api/simulate/retirement";
      const body = model === "gbm" ? gbm : ret;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      setResult(json as SimulationResponse);
      setElapsed(performance.now() - started);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [model, gbm, ret]);

  // Run once on first mount so the page isn't empty.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Monty Carlo Simulator
          </h1>
          <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] text-muted">
            web edition
          </span>
          <a
            href="https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noreferrer"
            title="View change history"
            className="rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent2 transition hover:brightness-125"
          >
            v{APP_VERSION}
          </a>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Instead of a single prediction, run thousands of randomized scenarios
          to see the full spectrum of possible financial outcomes and their
          probabilities. Same math as the Flutter + Python original, ported to
          run on the edge.
        </p>
      </header>

      {/* Model tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-line bg-panel p-1">
        <TabButton active={model === "gbm"} onClick={() => setModel("gbm")}>
          Portfolio forecast (GBM)
        </TabButton>
        <TabButton
          active={model === "retirement"}
          onClick={() => setModel("retirement")}
        >
          Retirement plan
        </TabButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {model === "gbm" ? "Assumptions" : "Plan inputs"}
          </h2>

          {model === "gbm" ? (
            <div className="space-y-5">
              <Field
                label="Beginning value"
                value={gbm.beginningValue}
                onChange={(v) => setGbm({ ...gbm, beginningValue: v })}
                min={1000}
                max={1_000_000}
                step={1000}
                display={formatCurrency(gbm.beginningValue)}
              />
              <Field
                label="Expected annual return (μ)"
                value={gbm.mu}
                onChange={(v) => setGbm({ ...gbm, mu: v })}
                min={-0.05}
                max={0.2}
                step={0.005}
                display={formatPercent(gbm.mu)}
              />
              <Field
                label="Volatility (σ)"
                value={gbm.sigma}
                onChange={(v) => setGbm({ ...gbm, sigma: v })}
                min={0}
                max={0.6}
                step={0.005}
                display={formatPercent(gbm.sigma)}
                hint="Annualized standard deviation of returns"
              />
              <Field
                label="Time horizon"
                value={gbm.years}
                onChange={(v) => setGbm({ ...gbm, years: v })}
                min={1}
                max={40}
                step={1}
                display={`${gbm.years} yr`}
              />
              <Field
                label="Simulations"
                value={gbm.nSims}
                onChange={(v) => setGbm({ ...gbm, nSims: v })}
                min={1000}
                max={50_000}
                step={1000}
                display={gbm.nSims.toLocaleString()}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <Field
                label="Starting balance"
                value={ret.startingBalance}
                onChange={(v) => setRet({ ...ret, startingBalance: v })}
                min={0}
                max={2_000_000}
                step={5000}
                display={formatCurrency(ret.startingBalance)}
              />
              <Field
                label="Annual contribution"
                value={ret.annualContribution}
                onChange={(v) => setRet({ ...ret, annualContribution: v })}
                min={0}
                max={100_000}
                step={1000}
                display={formatCurrency(ret.annualContribution)}
              />
              <Field
                label="Years until retirement"
                value={ret.yearsToRetire}
                onChange={(v) => setRet({ ...ret, yearsToRetire: v })}
                min={0}
                max={50}
                step={1}
                display={`${ret.yearsToRetire} yr`}
              />
              <Field
                label="Years in retirement"
                value={ret.retirementYears}
                onChange={(v) => setRet({ ...ret, retirementYears: v })}
                min={1}
                max={50}
                step={1}
                display={`${ret.retirementYears} yr`}
              />
              <Field
                label="Annual withdrawal (yr 1)"
                value={ret.annualWithdrawal}
                onChange={(v) => setRet({ ...ret, annualWithdrawal: v })}
                min={0}
                max={300_000}
                step={2500}
                display={formatCurrency(ret.annualWithdrawal)}
                hint="Grown each year by inflation"
              />
              <Field
                label="Expected return"
                value={ret.meanReturn}
                onChange={(v) => setRet({ ...ret, meanReturn: v })}
                min={-0.02}
                max={0.15}
                step={0.005}
                display={formatPercent(ret.meanReturn)}
              />
              <Field
                label="Return volatility"
                value={ret.stdReturn}
                onChange={(v) => setRet({ ...ret, stdReturn: v })}
                min={0}
                max={0.4}
                step={0.005}
                display={formatPercent(ret.stdReturn)}
              />
              <Field
                label="Inflation"
                value={ret.inflation}
                onChange={(v) => setRet({ ...ret, inflation: v })}
                min={0}
                max={0.1}
                step={0.0025}
                display={formatPercent(ret.inflation)}
              />
              <Field
                label="Simulations"
                value={ret.nSims}
                onChange={(v) => setRet({ ...ret, nSims: v })}
                min={1000}
                max={50_000}
                step={1000}
                display={ret.nSims.toLocaleString()}
              />
            </div>
          )}

          <button
            onClick={run}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Simulating…" : "Run simulation"}
          </button>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
            <button
              className="underline decoration-dotted underline-offset-2 hover:text-slate-200"
              onClick={() =>
                model === "gbm"
                  ? setGbm(DEFAULT_GBM)
                  : setRet(DEFAULT_RETIREMENT)
              }
            >
              Reset to defaults
            </button>
            {elapsed !== null ? <span>ran in {elapsed.toFixed(0)} ms</span> : null}
          </div>
        </section>

        {/* Results */}
        <section className="space-y-6">
          {error ? (
            <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
              {error}
            </div>
          ) : null}

          {model === "retirement" && result ? (
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="text-xs uppercase tracking-wide text-muted">
                Probability of not running out of money
              </div>
              <div className="mt-1 flex items-end gap-3">
                <span
                  className={`text-4xl font-bold tabular-nums ${
                    result.summary.successRate >= 0.8
                      ? "text-good"
                      : result.summary.successRate >= 0.5
                      ? "text-accent"
                      : "text-bad"
                  }`}
                >
                  {formatPercent(result.summary.successRate)}
                </span>
                <span className="pb-1 text-sm text-muted">
                  across {result.meta.nSims.toLocaleString()} simulated lifetimes
                </span>
              </div>
            </div>
          ) : null}

          {result ? <StatCards data={result} /> : null}

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">
              Trajectories &amp; percentile bands
            </h3>
            {result ? (
              <FanChart data={result} />
            ) : (
              <ChartPlaceholder loading={loading} />
            )}
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">
              Distribution of terminal outcomes
            </h3>
            {result ? (
              <Histogram data={result} />
            ) : (
              <ChartPlaceholder loading={loading} />
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
        <p>
          Educational tool — not financial advice. Returns are modeled with
          Geometric Brownian Motion (portfolio) and normally-distributed annual
          returns (retirement). Based on{" "}
          <a
            className="text-accent2 hover:underline"
            href="https://github.com/Bobs-Dev-Attic/MonteCarloSimulator"
            target="_blank"
            rel="noreferrer"
          >
            Bobs-Dev-Attic/MonteCarloSimulator
          </a>
          .
        </p>
        <p className="mt-2 tabular-nums">
          Version {APP_VERSION} —{" "}
          <a
            className="text-accent2 hover:underline"
            href="https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noreferrer"
          >
            change history
          </a>
        </p>
      </footer>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-accent text-ink"
          : "text-muted hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function ChartPlaceholder({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-muted">
      {loading ? "Crunching thousands of scenarios…" : "Run a simulation to see results."}
    </div>
  );
}
