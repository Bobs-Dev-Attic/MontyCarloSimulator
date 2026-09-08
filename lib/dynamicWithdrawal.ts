/**
 * Dynamic withdrawal strategy simulation (decumulation only).
 *
 * Compares three ways of deciding how much to spend each year in retirement,
 * against the SAME simulated market paths (common random numbers), so any
 * difference in outcomes is due to the spending rule, not sampling luck:
 *
 *  - fixed:      the classic "4% rule" — a fixed real amount, grown with
 *                inflation every year regardless of markets.
 *  - guardrails: Guyton–Klinger. Spending gets its inflation raise, but the
 *                raise is frozen after a down year (Withdrawal Rule), spending
 *                is cut when the current withdrawal rate drifts too high
 *                (Capital Preservation Rule) and bumped up when it drifts too
 *                low (Prosperity Rule).
 *  - ratchet:    Kitces' ratchet — spending is never cut; it only steps up (in
 *                real terms) when the portfolio has grown well past its start.
 *
 * The headline is how much these adaptive rules change the probability of ruin
 * (running out of money) versus fixed spending, and what they cost in spending
 * stability. All spending/balance outputs are in real (today's $) terms.
 */

import { Rng } from "./rng";
import { percentile } from "./aggregate";

export type WithdrawalStrategy = "fixed" | "guardrails" | "ratchet";

export interface DynamicWithdrawalParams {
  startingBalance: number;
  retirementYears: number;
  initialRate: number; // initial withdrawal rate, e.g. 0.05
  meanReturn: number;
  stdReturn: number;
  inflation: number;
  guardBand: number; // ± band around initial rate that triggers a change, e.g. 0.20
  guardAdjust: number; // size of each guardrail change, e.g. 0.10
  ratchetThreshold: number; // real growth over start that unlocks a raise, e.g. 0.50
  ratchetStep: number; // size of each ratchet raise, e.g. 0.10
  ratchetEvery: number; // check for a ratchet every N years
  nSims: number;
  seed: number | null;
}

export interface Bands {
  steps: number[];
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
}

export interface StrategyOutcome {
  id: WithdrawalStrategy;
  name: string;
  ruinProb: number;
  successRate: number;
  medianTerminalReal: number;
  p5TerminalReal: number;
  medianTotalRealSpend: number;
  medianRealSpendYr1: number;
  medianRealSpendFinal: number;
  avgCutYears: number; // average count of years with a real spending cut
  spendBands: Bands; // real spending per year
  balanceBands: Bands; // real balance per year
}

export interface DynamicWithdrawalResult {
  years: number;
  startingBalance: number;
  initialRate: number;
  nSims: number;
  strategies: StrategyOutcome[];
}

interface Accumulators {
  spendByYear: Float64Array[]; // [year 1..N][sim] real spending
  balanceByYear: Float64Array[]; // [year 0..N][sim] real balance
  terminalReal: Float64Array;
  totalRealSpend: Float64Array;
  cutYears: Float64Array;
  ruin: number;
}

function makeAcc(years: number, nSims: number): Accumulators {
  return {
    spendByYear: Array.from({ length: years }, () => new Float64Array(nSims)),
    balanceByYear: Array.from({ length: years + 1 }, () => new Float64Array(nSims)),
    terminalReal: new Float64Array(nSims),
    totalRealSpend: new Float64Array(nSims),
    cutYears: new Float64Array(nSims),
    ruin: 0,
  };
}

function bandsFrom(byYear: Float64Array[], startYear: number): Bands {
  const steps: number[] = [];
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];
  byYear.forEach((vals, i) => {
    const sorted = Float64Array.from(vals).sort();
    steps.push(startYear + i);
    p5.push(percentile(sorted, 5));
    p25.push(percentile(sorted, 25));
    p50.push(percentile(sorted, 50));
    p75.push(percentile(sorted, 75));
    p95.push(percentile(sorted, 95));
  });
  return { steps, p5, p25, p50, p75, p95 };
}

function median(values: Float64Array): number {
  return percentile(Float64Array.from(values).sort(), 50);
}

export function simulateDynamicWithdrawal(
  params: DynamicWithdrawalParams
): DynamicWithdrawalResult {
  const {
    startingBalance,
    retirementYears: years,
    initialRate,
    meanReturn,
    stdReturn,
    inflation,
    guardBand,
    guardAdjust,
    ratchetThreshold,
    ratchetStep,
    ratchetEvery,
    nSims,
    seed,
  } = params;

  if (years < 1) throw new Error("retirementYears must be at least 1");
  if (initialRate <= 0) throw new Error("initialRate must be positive");

  const initialWithdrawal = initialRate * startingBalance;
  const rng = new Rng(seed);

  const fixed = makeAcc(years, nSims);
  const guard = makeAcc(years, nSims);
  const ratchet = makeAcc(years, nSims);

  // Per-strategy running state within a path.
  for (let s = 0; s < nSims; s++) {
    let balF = startingBalance;
    let balG = startingBalance;
    let balR = startingBalance;
    let wF = initialWithdrawal; // nominal
    let wG = initialWithdrawal;
    let wR = initialWithdrawal;
    // 0 means "no prior spend yet", so year 1 is never counted as a cut.
    let prevRealF = 0;
    let prevRealG = 0;
    let prevRealR = 0;
    let depF = false;
    let depG = false;
    let depR = false;
    let prevReturn = 1; // >0 so no "down year" freeze applies in year 1

    fixed.balanceByYear[0][s] = startingBalance;
    guard.balanceByYear[0][s] = startingBalance;
    ratchet.balanceByYear[0][s] = startingBalance;

    for (let t = 1; t <= years; t++) {
      const r = rng.normal(meanReturn, stdReturn);
      const infFactor = Math.pow(1 + inflation, t - 1); // nominal→real deflator base

      // ----- Fixed (inflation-adjusted) -----
      if (!depF) {
        wF = t === 1 ? initialWithdrawal : wF * (1 + inflation);
        const depletedNow = wF >= balF;
        const take = depletedNow ? balF : wF;
        if (depletedNow) depF = true;
        balF -= take;
        balF *= 1 + r;
        const realSpend = take / infFactor;
        fixed.spendByYear[t - 1][s] = realSpend;
        fixed.totalRealSpend[s] += realSpend;
        // Only voluntary (rule-driven) reductions count as cuts, not the forced
        // drop in the year the money runs out.
        if (!depletedNow && realSpend < prevRealF * (1 - 1e-4)) fixed.cutYears[s]++;
        prevRealF = realSpend;
      }
      fixed.balanceByYear[t][s] = balF / Math.pow(1 + inflation, t);

      // ----- Guyton–Klinger guardrails -----
      if (!depG) {
        if (t === 1) {
          wG = initialWithdrawal;
        } else {
          // Withdrawal Rule: skip the inflation raise after a down year when
          // spending above the initial rate.
          const freeze = prevReturn < 0 && wG / balG > initialRate;
          let w = freeze ? wG : wG * (1 + inflation);
          // Guardrail changes only while enough of the horizon remains.
          if (t <= years * 0.85) {
            const rate = w / balG;
            if (rate > initialRate * (1 + guardBand)) w *= 1 - guardAdjust; // Capital Preservation
            else if (rate < initialRate * (1 - guardBand)) w *= 1 + guardAdjust; // Prosperity
          }
          wG = w;
        }
        const depletedNow = wG >= balG;
        const take = depletedNow ? balG : wG;
        if (depletedNow) depG = true;
        balG -= take;
        balG *= 1 + r;
        const realSpend = take / infFactor;
        guard.spendByYear[t - 1][s] = realSpend;
        guard.totalRealSpend[s] += realSpend;
        if (!depletedNow && realSpend < prevRealG * (1 - 1e-4)) guard.cutYears[s]++;
        prevRealG = realSpend;
      }
      guard.balanceByYear[t][s] = balG / Math.pow(1 + inflation, t);

      // ----- Ratchet (never cut, step up in good times) -----
      if (!depR) {
        if (t === 1) {
          wR = initialWithdrawal;
        } else {
          let w = wR * (1 + inflation); // hold real spending
          if ((t - 1) % Math.max(1, ratchetEvery) === 0) {
            const realBalance = balR / infFactor;
            if (realBalance >= startingBalance * (1 + ratchetThreshold)) {
              w *= 1 + ratchetStep; // permanent real raise
            }
          }
          wR = w;
        }
        const depletedNow = wR >= balR;
        const take = depletedNow ? balR : wR;
        if (depletedNow) depR = true;
        balR -= take;
        balR *= 1 + r;
        const realSpend = take / infFactor;
        ratchet.spendByYear[t - 1][s] = realSpend;
        ratchet.totalRealSpend[s] += realSpend;
        if (!depletedNow && realSpend < prevRealR * (1 - 1e-4)) ratchet.cutYears[s]++;
        prevRealR = realSpend;
      }
      ratchet.balanceByYear[t][s] = balR / Math.pow(1 + inflation, t);

      prevReturn = r;
    }

    const realDeflator = Math.pow(1 + inflation, years);
    fixed.terminalReal[s] = balF / realDeflator;
    guard.terminalReal[s] = balG / realDeflator;
    ratchet.terminalReal[s] = balR / realDeflator;
    if (depF) fixed.ruin++;
    if (depG) guard.ruin++;
    if (depR) ratchet.ruin++;
  }

  const build = (id: WithdrawalStrategy, name: string, acc: Accumulators): StrategyOutcome => {
    const sortedTerminal = Float64Array.from(acc.terminalReal).sort();
    let cutSum = 0;
    for (let i = 0; i < nSims; i++) cutSum += acc.cutYears[i];
    return {
      id,
      name,
      ruinProb: acc.ruin / nSims,
      successRate: 1 - acc.ruin / nSims,
      medianTerminalReal: percentile(sortedTerminal, 50),
      p5TerminalReal: percentile(sortedTerminal, 5),
      medianTotalRealSpend: median(acc.totalRealSpend),
      medianRealSpendYr1: median(acc.spendByYear[0]),
      medianRealSpendFinal: median(acc.spendByYear[years - 1]),
      avgCutYears: cutSum / nSims,
      spendBands: bandsFrom(acc.spendByYear, 1),
      balanceBands: bandsFrom(acc.balanceByYear, 0),
    };
  };

  return {
    years,
    startingBalance,
    initialRate,
    nSims,
    strategies: [
      build("fixed", "Fixed (inflation-adjusted)", fixed),
      build("guardrails", "Guyton–Klinger guardrails", guard),
      build("ratchet", "Ratcheting spend", ratchet),
    ],
  };
}
