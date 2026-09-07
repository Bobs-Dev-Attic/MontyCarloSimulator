/**
 * Retirement accumulation + withdrawal Monte Carlo model.
 *
 * Faithful TypeScript port of `functions/montecarlo/retirement.py`.
 *
 *   1. Accumulation: each year the balance grows by a randomly sampled annual
 *      return and an annual contribution is added.
 *   2. Withdrawal: each year the balance grows by a randomly sampled return and
 *      an (inflation-adjusted) withdrawal is taken out.
 *
 * The headline output is the probability of *not* running out of money -- the
 * fraction of paths whose balance is still positive at the end of the horizon.
 */

import { Rng } from "./rng";

export interface RetirementParams {
  startingBalance: number;
  annualContribution: number;
  yearsToRetire: number;
  retirementYears: number;
  annualWithdrawal: number;
  meanReturn: number;
  stdReturn: number;
  inflation?: number;
  nSims?: number;
  seed?: number | null;
}

export interface RetirementResult {
  steps: number[]; // year indices 0..totalYears (yearly, no downsampling needed)
  stepValues: Float64Array[]; // one array (over sims) per year
  terminal: Float64Array;
  sampleStepValues: number[][];
  yearsToRetire: number;
  totalYears: number;
  successRate: number; // fraction of paths ending with positive balance
}

export function simulateRetirement(
  params: RetirementParams
): RetirementResult {
  const {
    startingBalance,
    annualContribution,
    yearsToRetire,
    retirementYears,
    annualWithdrawal,
    meanReturn,
    stdReturn,
    inflation = 0.0,
    nSims = 10_000,
    seed = null,
  } = params;

  if (yearsToRetire < 0 || retirementYears < 0)
    throw new Error("year counts must be non-negative");
  if (stdReturn < 0) throw new Error("stdReturn must be non-negative");

  const rng = new Rng(seed);
  const totalYears = yearsToRetire + retirementYears;

  const steps = Array.from({ length: totalYears + 1 }, (_, i) => i);
  const stepValues: Float64Array[] = steps.map(() => new Float64Array(nSims));

  const nSample = Math.min(60, nSims);
  const sampleStepValues: number[][] = Array.from(
    { length: nSample },
    () => []
  );

  const terminal = new Float64Array(nSims);

  for (let s = 0; s < nSims; s++) {
    let balance = startingBalance;
    stepValues[0][s] = balance;
    if (s < nSample) sampleStepValues[s].push(balance);

    for (let t = 1; t <= totalYears; t++) {
      const r = rng.normal(meanReturn, stdReturn);
      balance = balance * (1.0 + r);
      if (t <= yearsToRetire) {
        balance += annualContribution;
      } else {
        const withdrawalYear = t - yearsToRetire - 1;
        balance -= annualWithdrawal * Math.pow(1.0 + inflation, withdrawalYear);
      }
      if (balance < 0) balance = 0.0; // a depleted path stays at zero
      stepValues[t][s] = balance;
      if (s < nSample) sampleStepValues[s].push(balance);
    }
    terminal[s] = balance;
  }

  let survivors = 0;
  for (let s = 0; s < nSims; s++) if (terminal[s] > 0) survivors++;

  return {
    steps,
    stepValues,
    terminal,
    sampleStepValues,
    yearsToRetire,
    totalYears,
    successRate: survivors / nSims,
  };
}
