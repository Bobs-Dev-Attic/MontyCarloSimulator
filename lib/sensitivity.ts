/**
 * One-at-a-time (OAT) sensitivity analysis feeding a tornado chart.
 *
 * For each input we hold everything else at the base case, move that one input
 * down and up by a fixed fraction, and record the resulting output metric. The
 * swing (|high - low|) ranks the inputs — the biggest bar is the input the
 * outcome is most sensitive to.
 *
 * Crucially, every run uses the SAME seed (common random numbers), so a bar
 * reflects the effect of the input change, not Monte Carlo sampling noise.
 */

import { simulateGbm } from "./gbm";
import { simulateRetirement } from "./retirement";
import { summaryStats } from "./aggregate";

export type SensModel = "gbm" | "retirement";
export type Metric = "median" | "p5" | "probLoss" | "successRate";
export type Fmt = "currency" | "percent" | "number";

export interface GbmInputs {
  beginningValue: number;
  mu: number;
  sigma: number;
  years: number;
}

export interface RetirementInputs {
  startingBalance: number;
  annualContribution: number;
  yearsToRetire: number;
  retirementYears: number;
  annualWithdrawal: number;
  meanReturn: number;
  stdReturn: number;
  inflation: number;
}

export interface VarSpec {
  key: string;
  label: string;
  inputFormat: Fmt;
  min: number; // clamp lower bound after perturbation
  round?: boolean; // round to integer (e.g. years)
}

const GBM_VARS: VarSpec[] = [
  { key: "beginningValue", label: "Beginning value", inputFormat: "currency", min: 1 },
  { key: "mu", label: "Expected return (μ)", inputFormat: "percent", min: -0.99 },
  { key: "sigma", label: "Volatility (σ)", inputFormat: "percent", min: 0.001 },
  { key: "years", label: "Time horizon", inputFormat: "number", min: 1, round: true },
];

const RETIREMENT_VARS: VarSpec[] = [
  { key: "startingBalance", label: "Starting balance", inputFormat: "currency", min: 0 },
  { key: "annualContribution", label: "Annual contribution", inputFormat: "currency", min: 0 },
  { key: "meanReturn", label: "Expected return", inputFormat: "percent", min: -0.99 },
  { key: "stdReturn", label: "Return volatility", inputFormat: "percent", min: 0 },
  { key: "annualWithdrawal", label: "Annual withdrawal", inputFormat: "currency", min: 0 },
  { key: "inflation", label: "Inflation", inputFormat: "percent", min: 0 },
  { key: "yearsToRetire", label: "Years to retirement", inputFormat: "number", min: 0, round: true },
  { key: "retirementYears", label: "Years in retirement", inputFormat: "number", min: 1, round: true },
];

export interface TornadoRow {
  key: string;
  label: string;
  inputFormat: Fmt;
  baseInput: number;
  lowInput: number;
  highInput: number;
  lowOut: number;
  highOut: number;
  swing: number;
}

export interface TornadoResult {
  model: SensModel;
  metric: Metric;
  metricFormat: Fmt;
  baseMetric: number;
  variationPct: number;
  nSims: number;
  rows: TornadoRow[];
}

function metricFormatFor(metric: Metric): Fmt {
  return metric === "probLoss" || metric === "successRate" ? "percent" : "currency";
}

function gbmMetric(
  inputs: GbmInputs,
  metric: Metric,
  nSims: number,
  seed: number
): number {
  const r = simulateGbm({
    beginningValue: inputs.beginningValue,
    mu: inputs.mu,
    sigma: inputs.sigma,
    years: inputs.years,
    stepsPerYear: 252,
    nSims,
    seed,
  });
  const s = summaryStats(r.terminal, inputs.beginningValue);
  return s[metric === "successRate" ? "successRate" : metric];
}

function retirementMetric(
  inputs: RetirementInputs,
  metric: Metric,
  nSims: number,
  seed: number
): number {
  const r = simulateRetirement({
    startingBalance: inputs.startingBalance,
    annualContribution: inputs.annualContribution,
    yearsToRetire: inputs.yearsToRetire,
    retirementYears: inputs.retirementYears,
    annualWithdrawal: inputs.annualWithdrawal,
    meanReturn: inputs.meanReturn,
    stdReturn: inputs.stdReturn,
    inflation: inputs.inflation,
    nSims,
    seed,
  });
  if (metric === "successRate") return r.successRate;
  const s = summaryStats(r.terminal, inputs.startingBalance);
  return s[metric];
}

function perturb(base: number, factor: number, spec: VarSpec): number {
  let v = base * factor;
  if (v < spec.min) v = spec.min;
  if (spec.round) v = Math.round(v);
  return v;
}

export function runTornado(
  model: SensModel,
  inputs: GbmInputs | RetirementInputs,
  metric: Metric,
  variationPct = 0.2,
  nSims = 4000,
  seed = 2026
): TornadoResult {
  const vars = model === "gbm" ? GBM_VARS : RETIREMENT_VARS;
  const evalMetric = (o: Record<string, number>) =>
    model === "gbm"
      ? gbmMetric(o as unknown as GbmInputs, metric, nSims, seed)
      : retirementMetric(o as unknown as RetirementInputs, metric, nSims, seed);

  const baseObj = inputs as unknown as Record<string, number>;
  const baseMetric = evalMetric(baseObj);

  const rows: TornadoRow[] = vars.map((spec) => {
    const baseInput = baseObj[spec.key];
    const lowInput = perturb(baseInput, 1 - variationPct, spec);
    const highInput = perturb(baseInput, 1 + variationPct, spec);
    const lowOut = evalMetric({ ...baseObj, [spec.key]: lowInput });
    const highOut = evalMetric({ ...baseObj, [spec.key]: highInput });
    return {
      key: spec.key,
      label: spec.label,
      inputFormat: spec.inputFormat,
      baseInput,
      lowInput,
      highInput,
      lowOut,
      highOut,
      swing: Math.abs(highOut - lowOut),
    };
  });

  rows.sort((a, b) => b.swing - a.swing);

  return {
    model,
    metric,
    metricFormat: metricFormatFor(metric),
    baseMetric,
    variationPct,
    nSims,
    rows,
  };
}
