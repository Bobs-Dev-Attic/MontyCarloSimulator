"use client";

import { useMemo } from "react";
import Field from "@/components/Field";
import { usePersistentState } from "@/lib/persist";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  gbmReverseStress,
  retirementReverseStress,
} from "@/lib/reverse";

type Mode = "gbm" | "retirement";

function ResultCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "accent";
  hint?: string;
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
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export default function ReverseStress() {
  const [mode, setMode] = usePersistentState<Mode>("reverse.mode", "gbm");

  // Portfolio (GBM) inputs
  const [beginningValue, setBeginningValue] = usePersistentState("reverse.beginningValue", 100_000);
  const [years, setYears] = usePersistentState("reverse.years", 10);
  const [mu, setMu] = usePersistentState("reverse.mu", 0.07);
  const [sigma, setSigma] = usePersistentState("reverse.sigma", 0.15);
  const [lossFraction, setLossFraction] = usePersistentState("reverse.lossFraction", 0.3);

  // Retirement inputs
  const [startingBalance, setStartingBalance] = usePersistentState("reverse.startingBalance", 100_000);
  const [annualContribution, setAnnualContribution] = usePersistentState("reverse.annualContribution", 15_000);
  const [yearsToRetire, setYearsToRetire] = usePersistentState("reverse.yearsToRetire", 25);
  const [retirementYears, setRetirementYears] = usePersistentState("reverse.retirementYears", 30);
  const [annualWithdrawal, setAnnualWithdrawal] = usePersistentState("reverse.annualWithdrawal", 60_000);
  const [inflation, setInflation] = usePersistentState("reverse.inflation", 0.025);
  const [meanReturn, setMeanReturn] = usePersistentState("reverse.meanReturn", 0.06);

  const gbm = useMemo(
    () => gbmReverseStress({ beginningValue, years, mu, sigma, lossFraction }),
    [beginningValue, years, mu, sigma, lossFraction]
  );

  const ret = useMemo(
    () =>
      retirementReverseStress({
        startingBalance,
        annualContribution,
        yearsToRetire,
        retirementYears,
        annualWithdrawal,
        inflation,
        meanReturn,
      }),
    [
      startingBalance,
      annualContribution,
      yearsToRetire,
      retirementYears,
      annualWithdrawal,
      inflation,
      meanReturn,
    ]
  );

  const oneInNText = (n: number) =>
    !isFinite(n) ? "essentially never" : n >= 2 ? `≈ 1 in ${Math.round(n).toLocaleString()}` : "more likely than not";

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 inline-flex rounded-lg border border-line bg-panel2 p-1">
          <button
            onClick={() => setMode("gbm")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === "gbm" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setMode("retirement")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === "retirement" ? "bg-accent text-ink" : "text-muted hover:text-slate-200"
            }`}
          >
            Retirement
          </button>
        </div>

        {mode === "gbm" ? (
          <div className="space-y-5">
            <Field
              label="Beginning value"
              value={beginningValue}
              onChange={setBeginningValue}
              min={1000}
              max={5_000_000}
              step={1000}
              display={formatCurrency(beginningValue)}
            />
            <Field
              label="Time horizon"
              value={years}
              onChange={setYears}
              min={1}
              max={40}
              step={1}
              display={`${years} yr`}
            />
            <Field
              label="Assumed return (μ)"
              value={mu}
              onChange={setMu}
              min={-0.05}
              max={0.2}
              step={0.005}
              display={formatPercent(mu)}
            />
            <Field
              label="Assumed volatility (σ)"
              value={sigma}
              onChange={setSigma}
              min={0.01}
              max={0.6}
              step={0.005}
              display={formatPercent(sigma)}
            />
            <div className="rounded-lg border border-bad/30 bg-bad/5 p-3">
              <Field
                label="Failure: portfolio falls by"
                value={lossFraction}
                onChange={setLossFraction}
                min={0.05}
                max={0.95}
                step={0.01}
                display={formatPercent(lossFraction)}
                hint={`Target value ${formatCurrency(gbm.targetValue)}`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Field label="Starting balance" value={startingBalance} onChange={setStartingBalance} min={0} max={2_000_000} step={5000} display={formatCurrency(startingBalance)} />
            <Field label="Annual contribution" value={annualContribution} onChange={setAnnualContribution} min={0} max={100_000} step={1000} display={formatCurrency(annualContribution)} />
            <Field label="Years until retirement" value={yearsToRetire} onChange={setYearsToRetire} min={0} max={50} step={1} display={`${yearsToRetire} yr`} />
            <Field label="Years in retirement" value={retirementYears} onChange={setRetirementYears} min={1} max={50} step={1} display={`${retirementYears} yr`} />
            <Field label="Annual withdrawal (yr 1)" value={annualWithdrawal} onChange={setAnnualWithdrawal} min={0} max={300_000} step={2500} display={formatCurrency(annualWithdrawal)} />
            <Field label="Inflation" value={inflation} onChange={setInflation} min={0} max={0.1} step={0.0025} display={formatPercent(inflation)} />
            <Field label="Assumed return" value={meanReturn} onChange={setMeanReturn} min={-0.02} max={0.15} step={0.005} display={formatPercent(meanReturn)} />
          </div>
        )}

        <p className="mt-5 text-[11px] text-muted">
          Deterministic — results update live and are exact (no random sampling).
        </p>
      </section>

      {/* Results */}
      <section className="space-y-6">
        {mode === "gbm" ? (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="text-xs uppercase tracking-wide text-muted">
                To lose {formatPercent(lossFraction)} over {years} years, the portfolio must return
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-bold tabular-nums text-bad">
                  {formatPercent(gbm.requiredCagr)}
                </span>
                <span className="pb-1 text-sm text-muted">per year (compound)</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Under μ={formatPercent(mu)}, σ={formatPercent(sigma)}, an outcome
                this bad or worse has probability{" "}
                <span className="font-semibold text-white">
                  {formatPercent(gbm.probability, 2)}
                </span>{" "}
                — {oneInNText(gbm.oneInN)}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultCard label="Target value" value={formatCurrency(gbm.targetValue)} tone="bad" hint={`from ${formatCurrency(beginningValue)}`} />
              <ResultCard label="Required annual return" value={formatPercent(gbm.requiredCagr)} tone="bad" />
              <ResultCard label="Total return" value={formatPercent(gbm.requiredTotalReturn)} />
              <ResultCard label="Severity (z-score)" value={`${gbm.zScore.toFixed(2)}σ`} tone="accent" hint="below assumed mean" />
              <ResultCard label="Probability ≤ target" value={formatPercent(gbm.probability, 2)} tone="accent" />
              <ResultCard label="Likelihood" value={oneInNText(gbm.oneInN)} />
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5 text-sm text-slate-300">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">How to read this</h3>
              <p>
                Reverse stress testing starts from the loss you want to survive
                and finds the market path that produces it. The{" "}
                <span className="text-white">required annual return</span> is the
                constant compound return that lands exactly on the failure value;
                the <span className="text-white">z-score</span> and{" "}
                <span className="text-white">probability</span> say how far into
                the tail that scenario sits under your own μ/σ assumptions — the
                smaller the probability, the more extreme the scenario you would
                need to fear.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2 p-5">
              <div className="text-xs uppercase tracking-wide text-muted">
                Reverse stress: what breaks this plan?
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                {ret.survivesAtAssumption ? (
                  <>
                    <span className="text-3xl font-bold tabular-nums text-good">Survives</span>
                    <span className="pb-1 text-sm text-muted">
                      at the assumed {formatPercent(ret.assumedReturn)} return
                      (ends {formatCurrency(ret.endBalanceAtAssumption)})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold tabular-nums text-bad">Runs out</span>
                    <span className="pb-1 text-sm text-muted">
                      {ret.depletionRetirementYear && ret.depletionRetirementYear > 0
                        ? `in retirement year ${ret.depletionRetirementYear}`
                        : "during accumulation"}{" "}
                      at the assumed {formatPercent(ret.assumedReturn)} return
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {ret.requiredReturn !== null ? (
                  <>
                    The plan needs a constant{" "}
                    <span className="font-semibold text-white">
                      {formatPercent(ret.requiredReturn)}
                    </span>{" "}
                    annual return to last the full horizon — you are assuming{" "}
                    <span
                      className={
                        ret.assumedReturn >= ret.requiredReturn
                          ? "font-semibold text-good"
                          : "font-semibold text-bad"
                      }
                    >
                      {formatPercent(ret.assumedReturn)}
                    </span>
                    {ret.assumedReturn >= ret.requiredReturn
                      ? ` (a ${formatPercent(ret.assumedReturn - ret.requiredReturn)} cushion).`
                      : ` (a ${formatPercent(ret.requiredReturn - ret.assumedReturn)} shortfall).`}
                  </>
                ) : (
                  "The required return is outside the searchable range for these inputs."
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultCard
                label="Required return"
                value={ret.requiredReturn !== null ? formatPercent(ret.requiredReturn) : "—"}
                tone={ret.requiredReturn !== null && ret.assumedReturn >= ret.requiredReturn ? "good" : "bad"}
                hint="to end at $0"
              />
              <ResultCard
                label="Max withdrawal (yr 1)"
                value={ret.maxWithdrawal !== null ? formatCurrency(ret.maxWithdrawal) : "—"}
                tone={ret.maxWithdrawal !== null && ret.maxWithdrawal >= ret.currentWithdrawal ? "good" : "bad"}
                hint={`you draw ${formatCurrency(ret.currentWithdrawal)}`}
              />
              <ResultCard
                label="Max crash at retirement"
                value={ret.maxRetirementShock !== null ? formatPercent(ret.maxRetirementShock) : "—"}
                tone="accent"
                hint="one-time, absorbable"
              />
              <ResultCard
                label="Money lasts"
                value={
                  ret.depletionRetirementYear === null
                    ? "Full horizon"
                    : ret.depletionRetirementYear > 0
                    ? `${ret.depletionRetirementYear} ret. yrs`
                    : "Depletes early"
                }
                tone={ret.depletionRetirementYear === null ? "good" : "bad"}
              />
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5 text-sm text-slate-300">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">How to read this</h3>
              <p>
                Each figure is solved deterministically from your plan: the{" "}
                <span className="text-white">required return</span> is the
                constant return that just exhausts the fund at the end of the
                horizon, the <span className="text-white">max withdrawal</span> is
                the largest first-year spend your assumed return can sustain, and
                the <span className="text-white">max crash at retirement</span> is
                the biggest one-time market drop (on the first day of retirement)
                the plan can still absorb. Compare each against what you are
                planning to see how much cushion — or shortfall — you have.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
