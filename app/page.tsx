"use client";

import { useCallback, useEffect, useState } from "react";
import type { SimulationResponse } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import Field from "@/components/Field";
import FanChart from "@/components/FanChart";
import Histogram from "@/components/Histogram";
import StatCards from "@/components/StatCards";
import HistoryPanel from "@/components/HistoryPanel";
import CompareView from "@/components/CompareView";
import ReverseStress from "@/components/ReverseStress";
import MacroShock from "@/components/MacroShock";
import Sensitivity from "@/components/Sensitivity";
import MultiAsset from "@/components/MultiAsset";
import RiskGlidePath from "@/components/RiskGlidePath";
import StressCompare from "@/components/StressCompare";
import DynamicWithdrawal from "@/components/DynamicWithdrawal";
import SequenceRisk from "@/components/SequenceRisk";
import PreferencesPage from "@/components/PreferencesPage";
import NavMenu, { type NavItem } from "@/components/NavMenu";
import ProfileBar from "@/components/ProfileBar";
import { RealBadge } from "@/components/RealToggle";
import { usePersistentState } from "@/lib/persist";
import { useReal } from "@/lib/realContext";
import { useApplyAllHandler } from "@/lib/broadcast";
import { useProgress } from "@/lib/progress";
import {
  type HistoryEntry,
  loadHistory,
  addEntry,
  removeEntry,
  clearHistory,
  entryFromResult,
} from "@/lib/history";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

type Model = "gbm" | "retirement";

interface GbmState {
  beginningValue: number;
  mu: number;
  sigma: number;
  years: number;
  nSims: number;
  seed: number | null;
  distKind: "normal" | "t";
  nu: number;
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
  distKind: "normal",
  nu: 5,
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

type Tab = Model | "reverse" | "macro" | "sensitivity" | "multiasset" | "glide" | "stress" | "dynwithdraw" | "seqrisk" | "prefs";

const NAV_ITEMS: NavItem[] = [
  { id: "gbm", label: "Portfolio forecast (GBM)", hint: "Single-asset growth" },
  { id: "retirement", label: "Retirement plan", hint: "Save, withdraw, success rate" },
  { id: "dynwithdraw", label: "Dynamic withdrawals", hint: "Guardrails vs. fixed spending" },
  { id: "seqrisk", label: "Sequence risk", hint: "Cash buffer / bond tent sizing" },
  { id: "reverse", label: "Reverse stress test", hint: "Solve for the failure scenario" },
  { id: "macro", label: "Macro shock", hint: "Geopolitical / market crashes" },
  { id: "sensitivity", label: "Sensitivity", hint: "Tornado chart" },
  { id: "multiasset", label: "Multi-asset", hint: "Correlated portfolio" },
  { id: "glide", label: "Risk glide path", hint: "Risk tolerance over time" },
  { id: "stress", label: "Stress compare", hint: "All scenarios side by side" },
  { id: "prefs", label: "Preferences", hint: "Themes, display, ranges, import/export" },
];

export default function Page() {
  const [tab, setTab] = usePersistentState<Tab>("ui.tab", "gbm");
  const [model, setModel] = usePersistentState<Model>("ui.model", "gbm");
  const [gbm, setGbm] = usePersistentState<GbmState>("gbm.settings", DEFAULT_GBM);
  const [ret, setRet] = usePersistentState<RetirementState>("ret.settings", DEFAULT_RETIREMENT);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  // Simulation history (persisted in the browser) + compare selection.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { adjust } = useReal();
  const progress = useProgress();

  const selectTab = useCallback(
    (id: string) => {
      if (id === "gbm" || id === "retirement") setModel(id);
      setTab(id as Tab);
    },
    [setModel, setTab]
  );

  // Receive "apply to all tabs" broadcasts and map them onto both models.
  useApplyAllHandler(
    useCallback((key, value) => {
      setGbm((p) => ({
        ...p,
        ...(key === "beginningValue" ? { beginningValue: value } : {}),
        ...(key === "mu" ? { mu: value } : {}),
        ...(key === "sigma" ? { sigma: value } : {}),
        ...(key === "years" ? { years: value } : {}),
        ...(key === "nSims" ? { nSims: value } : {}),
      }));
      setRet((p) => ({
        ...p,
        ...(key === "beginningValue" ? { startingBalance: value } : {}),
        ...(key === "mu" ? { meanReturn: value } : {}),
        ...(key === "sigma" ? { stdReturn: value } : {}),
        ...(key === "nSims" ? { nSims: value } : {}),
      }));
    }, [setGbm, setRet])
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : // Keep at most two selected (drop the oldest).
          [...prev, id].slice(-2)
    );
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const started = performance.now();
    const work =
      model === "gbm"
        ? gbm.nSims * Math.max(1, gbm.years)
        : ret.nSims * Math.max(1, ret.yearsToRetire + ret.retirementYears);
    const tracker = progress.track(
      model,
      work,
      model === "gbm" ? "Running portfolio forecast" : "Running retirement simulation"
    );
    try {
      const endpoint =
        model === "gbm" ? "/api/simulate/gbm" : "/api/simulate/retirement";
      const body =
        model === "gbm"
          ? {
              ...gbm,
              dist: { kind: gbm.distKind, nu: gbm.nu },
              // Fat tails aggregate away over ~250 daily steps (CLT), so model
              // Student-t returns at annual frequency where the heavy tails are
              // real and visible. Normal stays daily for a smooth fan chart
              // (its terminal distribution is identical at any step count).
              ...(gbm.distKind === "t" ? { stepsPerYear: 1 } : {}),
            }
          : ret;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation failed");
      const response = json as SimulationResponse;
      setResult(response);
      setElapsed(performance.now() - started);
      // Record the run in history.
      const entry = entryFromResult(
        model,
        body as unknown as Record<string, number | null>,
        response
      );
      setHistory((prev) => addEntry(prev, entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setResult(null);
    } finally {
      setLoading(false);
      tracker.done();
    }
  }, [model, gbm, ret, progress]);

  // Load saved history, then run once on first mount so the page isn't empty.
  useEffect(() => {
    setHistory(loadHistory());
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compareEntries = selected
    .map((id) => history.find((e) => e.id === id))
    .filter((e): e is HistoryEntry => Boolean(e));

  // Display view: nominal or real (today's $) depending on the global toggle.
  const view = result ? adjust(result) : null;

  const currentView = NAV_ITEMS.find((i) => i.id === tab);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <NavMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            items={NAV_ITEMS}
            active={tab}
            onSelect={selectTab}
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Monty Carlo Simulator
          </h1>
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
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl text-sm text-muted">
            Instead of a single prediction, run thousands of randomized scenarios
            to see the full spectrum of possible financial outcomes and their
            probabilities. Same math as the Flutter + Python original, ported to
            run on the edge.
          </p>
          <div className="shrink-0 sm:flex sm:justify-end">
            <ProfileBar />
          </div>
        </div>
      </header>

      {/* Active view heading (navigation is via the menu button) */}
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-white">
          {currentView?.label ?? "View"}
        </h2>
        {currentView?.hint ? (
          <span className="text-xs text-muted">{currentView.hint}</span>
        ) : null}
      </div>

      {tab === "prefs" ? (
        <PreferencesPage />
      ) : tab === "reverse" ? (
        <ReverseStress />
      ) : tab === "macro" ? (
        <MacroShock />
      ) : tab === "sensitivity" ? (
        <Sensitivity />
      ) : tab === "multiasset" ? (
        <MultiAsset />
      ) : tab === "glide" ? (
        <RiskGlidePath />
      ) : tab === "stress" ? (
        <StressCompare />
      ) : tab === "dynwithdraw" ? (
        <DynamicWithdrawal />
      ) : tab === "seqrisk" ? (
        <SequenceRisk />
      ) : (
      <>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            {model === "gbm" ? "Assumptions" : "Plan inputs"}
          </h2>

          {model === "gbm" ? (
            <div className="space-y-5">
              <Field
                label="Beginning value" info="beginningValue"
                value={gbm.beginningValue}
                onChange={(v) => setGbm({ ...gbm, beginningValue: v })}
                min={1000}
                max={5_000_000}
                step={1000}
                display={formatCurrency(gbm.beginningValue)}
                sharedKey="beginningValue"
              />
              <Field
                label="Expected annual return (μ)" info="mu"
                value={gbm.mu}
                onChange={(v) => setGbm({ ...gbm, mu: v })}
                min={-0.05}
                max={0.2}
                step={0.005}
                display={formatPercent(gbm.mu)}
                sharedKey="mu"
              />
              <Field
                label="Volatility (σ)" info="sigma"
                value={gbm.sigma}
                onChange={(v) => setGbm({ ...gbm, sigma: v })}
                min={0}
                max={0.6}
                step={0.005}
                display={formatPercent(gbm.sigma)}
                hint="Annualized standard deviation of returns"
                sharedKey="sigma"
              />
              <Field
                label="Time horizon" info="years"
                value={gbm.years}
                onChange={(v) => setGbm({ ...gbm, years: v })}
                min={1}
                max={40}
                step={1}
                display={`${gbm.years} yr`}
                sharedKey="years"
              />
              <Field
                label="Simulations" info="nSims"
                value={gbm.nSims}
                onChange={(v) => setGbm({ ...gbm, nSims: v })}
                min={1000}
                max={50_000}
                step={1000}
                display={gbm.nSims.toLocaleString()}
                sharedKey="nSims"
              />

              {/* Return distribution: Normal vs fat-tailed Student-t */}
              <div>
                <label className="text-sm text-slate-200">Return distribution</label>
                <div className="mt-2 inline-flex rounded-lg border border-line bg-panel2 p-1">
                  <button
                    onClick={() => setGbm({ ...gbm, distKind: "normal" })}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      gbm.distKind === "normal" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setGbm({ ...gbm, distKind: "t" })}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      gbm.distKind === "t" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"
                    }`}
                  >
                    Fat tails (Student-t)
                  </button>
                </div>
                {gbm.distKind === "t" ? (
                  <div className="mt-4">
                    <Field
                      label="Degrees of freedom (ν)" info="nu"
                      value={gbm.nu}
                      onChange={(v) => setGbm({ ...gbm, nu: v })}
                      min={2.5}
                      max={30}
                      step={0.5}
                      display={gbm.nu.toFixed(1)}
                      hint="Lower ν → fatter tails (more extreme booms & crashes) on annual returns, at the same volatility."
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted">
                    Standard log-normal returns. Switch to Student-t to model
                    heavier tails at the same volatility.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <Field
                label="Starting balance" info="beginningValue"
                value={ret.startingBalance}
                onChange={(v) => setRet({ ...ret, startingBalance: v })}
                min={0}
                max={2_000_000}
                step={5000}
                display={formatCurrency(ret.startingBalance)}
                sharedKey="beginningValue"
              />
              <Field
                label="Annual contribution" info="contribution"
                value={ret.annualContribution}
                onChange={(v) => setRet({ ...ret, annualContribution: v })}
                min={0}
                max={100_000}
                step={1000}
                display={formatCurrency(ret.annualContribution)}
              />
              <Field
                label="Years until retirement" info="years"
                value={ret.yearsToRetire}
                onChange={(v) => setRet({ ...ret, yearsToRetire: v })}
                min={0}
                max={50}
                step={1}
                display={`${ret.yearsToRetire} yr`}
              />
              <Field
                label="Years in retirement" info="years"
                value={ret.retirementYears}
                onChange={(v) => setRet({ ...ret, retirementYears: v })}
                min={1}
                max={50}
                step={1}
                display={`${ret.retirementYears} yr`}
              />
              <Field
                label="Annual withdrawal (yr 1)" info="withdrawal"
                value={ret.annualWithdrawal}
                onChange={(v) => setRet({ ...ret, annualWithdrawal: v })}
                min={0}
                max={300_000}
                step={2500}
                display={formatCurrency(ret.annualWithdrawal)}
                hint="Grown each year by inflation"
              />
              <Field
                label="Expected return" info="mu"
                value={ret.meanReturn}
                onChange={(v) => setRet({ ...ret, meanReturn: v })}
                min={-0.02}
                max={0.15}
                step={0.005}
                display={formatPercent(ret.meanReturn)}
                sharedKey="mu"
              />
              <Field
                label="Return volatility" info="sigma"
                value={ret.stdReturn}
                onChange={(v) => setRet({ ...ret, stdReturn: v })}
                min={0}
                max={0.4}
                step={0.005}
                display={formatPercent(ret.stdReturn)}
                sharedKey="sigma"
              />
              <Field
                label="Inflation" info="inflation"
                value={ret.inflation}
                onChange={(v) => setRet({ ...ret, inflation: v })}
                min={0}
                max={0.1}
                step={0.0025}
                display={formatPercent(ret.inflation)}
              />
              <Field
                label="Simulations" info="nSims"
                value={ret.nSims}
                onChange={(v) => setRet({ ...ret, nSims: v })}
                min={1000}
                max={50_000}
                step={1000}
                display={ret.nSims.toLocaleString()}
                sharedKey="nSims"
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

          {view ? <StatCards data={view} /> : null}

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              Trajectories &amp; percentile bands <RealBadge />
            </h3>
            {view ? (
              <FanChart data={view} />
            ) : (
              <ChartPlaceholder loading={loading} />
            )}
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              Distribution of terminal outcomes <RealBadge />
            </h3>
            {view ? (
              <Histogram data={view} />
            ) : (
              <ChartPlaceholder loading={loading} />
            )}
          </div>
        </section>
      </div>

      {/* Simulation history + comparison (full width) */}
      <div className="mt-6 space-y-6">
        {comparing && compareEntries.length === 2 ? (
          <CompareView
            a={compareEntries[0]}
            b={compareEntries[1]}
            onClose={() => setComparing(false)}
          />
        ) : null}

        <HistoryPanel
          entries={history}
          selected={selected}
          onToggleSelect={toggleSelect}
          onDelete={(id) => {
            setHistory((prev) => removeEntry(prev, id));
            setSelected((prev) => prev.filter((x) => x !== id));
          }}
          onClear={() => {
            setHistory(clearHistory());
            setSelected([]);
            setComparing(false);
          }}
          onCompare={() => setComparing(true)}
        />
      </div>
      </>
      )}

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

function ChartPlaceholder({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-[360px] items-center justify-center text-sm text-muted">
      {loading ? "Crunching thousands of scenarios…" : "Run a simulation to see results."}
    </div>
  );
}
