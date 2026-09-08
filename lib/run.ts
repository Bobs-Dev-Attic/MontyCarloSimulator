/**
 * Orchestration layer: run a model, aggregate it, and shape the compact JSON
 * response the browser consumes. Kept separate from the API route so it can be
 * unit-tested and reused.
 */

import { simulateGbm, type ShockConfig } from "./gbm";
import { simulateRetirement } from "./retirement";
import { simulateMultiAsset, type Asset } from "./multiasset";
import { simulateGlidePath, type Waypoint } from "./glidepath";
import {
  simulateDynamicWithdrawal,
  type DynamicWithdrawalParams,
  type DynamicWithdrawalResult,
} from "./dynamicWithdrawal";
import {
  simulateSequenceRisk,
  type SequenceRiskParams,
  type SequenceRiskResult,
} from "./sequenceRisk";
import {
  simulateLongevity,
  type LongevityParams,
  type LongevityResult,
  type Sex,
} from "./mortality";
import {
  simulateCareCosts,
  type CareParams,
  type CareResult,
} from "./careCosts";
import {
  simulateTax,
  type TaxParams,
  type TaxResult,
  type Filing,
} from "./tax";
import {
  percentileBands,
  terminalHistogram,
  summaryStats,
  type SummaryStats,
} from "./aggregate";
import { SCENARIOS, scenarioById } from "./scenarios";
import type {
  GbmRequest,
  RetirementRequest,
  SimulationResponse,
  SamplePath,
} from "./types";

const MAX_SIMS = 50_000;

function clampSims(n: number | undefined): number {
  const v = Math.floor(n ?? 10_000);
  if (!Number.isFinite(v) || v < 100) return 100;
  return Math.min(v, MAX_SIMS);
}

function buildSamplePaths(
  steps: number[],
  sampleStepValues: number[][],
  unitPerStep: number,
  maxPaths = 40
): SamplePath[] {
  const xs = steps.map((s) => s * unitPerStep);
  const n = Math.min(maxPaths, sampleStepValues.length);
  const out: SamplePath[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ steps: xs, values: sampleStepValues[i] });
  }
  return out;
}

export function runGbm(
  req: GbmRequest,
  shock?: ShockConfig
): SimulationResponse {
  const nSims = clampSims(req.nSims);
  const stepsPerYear = req.stepsPerYear ?? 252;
  const result = simulateGbm({
    beginningValue: req.beginningValue,
    mu: req.mu,
    sigma: req.sigma,
    years: req.years,
    stepsPerYear,
    nSims,
    contributionPerStep: req.contributionPerStep ?? 0,
    seed: req.seed ?? null,
    shock,
    dist: req.dist,
  });

  const unitPerStep = 1 / stepsPerYear; // step index -> years
  const bandsRaw = percentileBands(result.steps, result.stepValues);
  const bands = { ...bandsRaw, steps: result.steps.map((s) => s * unitPerStep) };

  return {
    model: "gbm",
    bands,
    histogram: terminalHistogram(result.terminal),
    summary: summaryStats(result.terminal, req.beginningValue),
    samplePaths: buildSamplePaths(result.steps, result.sampleStepValues, unitPerStep),
    xAxis: { label: "Years", unitPerStep, unit: "yr" },
    meta: {
      nSims,
      seed: req.seed ?? null,
      years: req.years,
      stepsPerYear,
      beginningValue: req.beginningValue,
      dist: req.dist?.kind ?? "normal",
      nu: req.dist?.kind === "t" ? req.dist?.nu ?? 5 : null,
      ...(result.shockStats
        ? {
            fracWithShock: result.shockStats.fracWithShock,
            avgShocks: result.shockStats.avgShocks,
          }
        : {}),
    },
  };
}

export interface MacroShockResponse {
  baseline: SimulationResponse;
  shocked: SimulationResponse;
}

/**
 * Run the portfolio both without and with a macro shock overlay (same seed), so
 * the client can show the impact of the shock against the no-shock baseline.
 */
export function runMacroShock(
  req: GbmRequest,
  shock: ShockConfig
): MacroShockResponse {
  return {
    baseline: runGbm(req),
    shocked: runGbm(req, shock),
  };
}

export interface MultiAssetRequest {
  assets: Asset[];
  corr: number[][];
  beginningValue: number;
  years: number;
  nSims?: number;
  seed?: number | null;
  rebalance?: boolean;
}

export function runMultiAsset(req: MultiAssetRequest): SimulationResponse {
  const nSims = clampSims(req.nSims);
  const stepsPerYear = 52;
  const result = simulateMultiAsset({
    assets: req.assets,
    corr: req.corr,
    beginningValue: req.beginningValue,
    years: req.years,
    stepsPerYear,
    nSims,
    seed: req.seed ?? null,
    rebalance: req.rebalance ?? false,
  });

  const unitPerStep = 1 / stepsPerYear;
  const bandsRaw = percentileBands(result.steps, result.stepValues);
  const bands = { ...bandsRaw, steps: result.steps.map((s) => s * unitPerStep) };

  return {
    model: "gbm",
    bands,
    histogram: terminalHistogram(result.terminal),
    summary: summaryStats(result.terminal, req.beginningValue),
    samplePaths: buildSamplePaths(result.steps, result.sampleStepValues, unitPerStep),
    xAxis: { label: "Years", unitPerStep, unit: "yr" },
    meta: {
      nSims,
      seed: req.seed ?? null,
      years: req.years,
      beginningValue: req.beginningValue,
      rebalance: req.rebalance ?? false,
      expectedReturn: result.expectedReturn,
      portfolioVol: result.portfolioVol,
      undiversifiedVol: result.undiversifiedVol,
      diversificationBenefit: result.undiversifiedVol - result.portfolioVol,
    },
  };
}

export interface GlidePathRequest {
  riskyMu: number;
  riskySigma: number;
  safeMu: number;
  safeSigma: number;
  rho: number;
  waypoints: Waypoint[];
  beginningValue: number;
  years: number;
  annualContribution?: number;
  nSims?: number;
  seed?: number | null;
}

export function runGlidePath(req: GlidePathRequest): SimulationResponse {
  const nSims = clampSims(req.nSims);
  const stepsPerYear = 12;
  const result = simulateGlidePath({
    riskyMu: req.riskyMu,
    riskySigma: req.riskySigma,
    safeMu: req.safeMu,
    safeSigma: req.safeSigma,
    rho: req.rho,
    waypoints: req.waypoints,
    beginningValue: req.beginningValue,
    years: req.years,
    annualContribution: req.annualContribution ?? 0,
    stepsPerYear,
    nSims,
    seed: req.seed ?? null,
  });

  const unitPerStep = 1 / stepsPerYear;
  const bandsRaw = percentileBands(result.steps, result.stepValues);
  const bands = { ...bandsRaw, steps: result.steps.map((s) => s * unitPerStep) };

  return {
    model: "gbm",
    bands,
    histogram: terminalHistogram(result.terminal),
    summary: summaryStats(result.terminal, req.beginningValue),
    samplePaths: buildSamplePaths(result.steps, result.sampleStepValues, unitPerStep),
    xAxis: { label: "Years", unitPerStep, unit: "yr" },
    meta: {
      nSims,
      seed: req.seed ?? null,
      years: req.years,
      beginningValue: req.beginningValue,
      startAlloc: result.startAlloc,
      endAlloc: result.endAlloc,
      curve: result.curve,
    },
  };
}

// ---------------------------------------------------------------------------
// Stress-test comparison: baseline + every scenario against the same portfolio
// ---------------------------------------------------------------------------

export interface StressScenarioResult {
  id: string;
  name: string;
  isBaseline: boolean;
  summary: SummaryStats;
  fracWithShock: number;
  avgShocks: number;
  medianCurve: { x: number; p50: number }[];
}

export interface StressCompareRequest {
  beginningValue: number;
  mu: number;
  sigma: number;
  years: number;
  nSims?: number;
  seed?: number | null;
  scenarioIds?: string[]; // defaults to all library scenarios (except "custom")
}

export interface StressCompareResponse {
  years: number;
  beginningValue: number;
  nSims: number;
  baseline: StressScenarioResult;
  scenarios: StressScenarioResult[];
}

function runOneStress(
  req: StressCompareRequest,
  nSims: number,
  stepsPerYear: number,
  id: string,
  name: string,
  shock: ShockConfig | undefined
): StressScenarioResult {
  const result = simulateGbm({
    beginningValue: req.beginningValue,
    mu: req.mu,
    sigma: req.sigma,
    years: req.years,
    stepsPerYear,
    nSims,
    seed: req.seed ?? 2026, // shared seed across scenarios (common random numbers)
    shock,
  });
  const bands = percentileBands(result.steps, result.stepValues);
  const medianCurve = bands.steps.map((s, i) => ({
    x: s / stepsPerYear,
    p50: bands.p50[i],
  }));
  return {
    id,
    name,
    isBaseline: !shock,
    summary: summaryStats(result.terminal, req.beginningValue),
    fracWithShock: result.shockStats?.fracWithShock ?? 0,
    avgShocks: result.shockStats?.avgShocks ?? 0,
    medianCurve,
  };
}

export function runStressCompare(
  req: StressCompareRequest
): StressCompareResponse {
  const nSims = clampSims(req.nSims);
  const stepsPerYear = 52; // weekly is plenty for scenario comparison and fast
  const ids =
    req.scenarioIds && req.scenarioIds.length > 0
      ? req.scenarioIds
      : SCENARIOS.filter((s) => s.id !== "custom").map((s) => s.id);

  const baseline = runOneStress(req, nSims, stepsPerYear, "baseline", "No shock (baseline)", undefined);
  const scenarios = ids.map((id) => {
    const sc = scenarioById(id);
    return runOneStress(req, nSims, stepsPerYear, sc.id, sc.name, sc.config);
  });

  return { years: req.years, beginningValue: req.beginningValue, nSims, baseline, scenarios };
}

export function runDynamicWithdrawal(
  req: Partial<DynamicWithdrawalParams>
): DynamicWithdrawalResult {
  const nSims = Math.min(clampSims(req.nSims), 20_000);
  return simulateDynamicWithdrawal({
    startingBalance: req.startingBalance ?? 1_000_000,
    retirementYears: Math.round(req.retirementYears ?? 30),
    initialRate: req.initialRate ?? 0.05,
    meanReturn: req.meanReturn ?? 0.06,
    stdReturn: req.stdReturn ?? 0.12,
    inflation: req.inflation ?? 0.025,
    guardBand: req.guardBand ?? 0.2,
    guardAdjust: req.guardAdjust ?? 0.1,
    ratchetThreshold: req.ratchetThreshold ?? 0.5,
    ratchetStep: req.ratchetStep ?? 0.1,
    ratchetEvery: Math.round(req.ratchetEvery ?? 3),
    nSims,
    seed: req.seed ?? null,
  });
}

export function runSequenceRisk(
  req: Partial<SequenceRiskParams>
): SequenceRiskResult {
  const nSims = Math.min(clampSims(req.nSims), 15_000);
  return simulateSequenceRisk({
    startingBalance: req.startingBalance ?? 1_000_000,
    retirementYears: Math.round(req.retirementYears ?? 30),
    annualSpend: req.annualSpend ?? 35_000,
    inflation: req.inflation ?? 0.025,
    equityMean: req.equityMean ?? 0.07,
    equityVol: req.equityVol ?? 0.16,
    bufferYield: req.bufferYield ?? 0.03,
    bearYears: Math.round(req.bearYears ?? 3),
    bearMean: req.bearMean ?? -0.05,
    bearVol: req.bearVol ?? 0.20,
    troughDrawdown: req.troughDrawdown ?? 0.1,
    refillBuffer: req.refillBuffer ?? true,
    maxBufferYears: Math.round(req.maxBufferYears ?? 8),
    targetSellProb: req.targetSellProb ?? 0.05,
    nSims,
    seed: req.seed ?? null,
  });
}

export function runLongevity(req: Partial<LongevityParams>): LongevityResult {
  const sex = (s: unknown, d: Sex): Sex => (s === "male" || s === "female" ? s : d);
  return simulateLongevity({
    ageA: Math.round(req.ageA ?? 65),
    sexA: sex(req.sexA, "male"),
    couple: Boolean(req.couple),
    ageB: Math.round(req.ageB ?? 63),
    sexB: sex(req.sexB, "female"),
    longevityAdj: req.longevityAdj ?? 0,
    startingBalance: req.startingBalance ?? 1_000_000,
    annualSpend: req.annualSpend ?? 45_000,
    realReturn: req.realReturn ?? 0.035,
    vol: req.vol ?? 0.1,
    survivorSpend: req.survivorSpend ?? 0.75,
    nSims: Math.min(Math.max(1000, Math.round(req.nSims ?? 10_000)), 50_000),
    seed: req.seed ?? null,
  });
}

export function runCareCosts(req: Partial<CareParams>): CareResult {
  return simulateCareCosts({
    startAge: Math.round(req.startAge ?? 65),
    startingBalance: req.startingBalance ?? 1_000_000,
    baseSpend: req.baseSpend ?? 45_000,
    realReturn: req.realReturn ?? 0.035,
    vol: req.vol ?? 0.1,
    actToAssisted: req.actToAssisted ?? 0.03,
    actToSkilled: req.actToSkilled ?? 0.005,
    actToDead: req.actToDead ?? 0.012,
    asstToSkilled: req.asstToSkilled ?? 0.1,
    asstToDead: req.asstToDead ?? 0.08,
    asstToActive: req.asstToActive ?? 0.05,
    skilledToDead: req.skilledToDead ?? 0.25,
    ageRamp: req.ageRamp ?? 0.05,
    assistedCost: req.assistedCost ?? 60_000,
    skilledCost: req.skilledCost ?? 110_000,
    nSims: Math.min(Math.max(1000, Math.round(req.nSims ?? 10_000)), 50_000),
    seed: req.seed ?? null,
  });
}

export function runTax(req: Partial<TaxParams>): TaxResult {
  const filing: Filing = req.filing === "mfj" ? "mfj" : "single";
  const clamp01 = (v: number | undefined, d: number) =>
    Math.min(1, Math.max(0, v ?? d));
  return simulateTax({
    startAge: Math.round(req.startAge ?? 62),
    filing,
    years: Math.min(50, Math.max(1, Math.round(req.years ?? 30))),
    taxable: Math.max(0, req.taxable ?? 0),
    taxableBasisPct: clamp01(req.taxableBasisPct, 0.6),
    deferred: Math.max(0, req.deferred ?? 1_200_000),
    roth: Math.max(0, req.roth ?? 150_000),
    annualSpend: Math.max(0, req.annualSpend ?? 60_000),
    otherIncome: Math.max(0, req.otherIncome ?? 30_000),
    nominalReturn: req.nominalReturn ?? 0.06,
    inflation: req.inflation ?? 0.025,
    ltcgRate: clamp01(req.ltcgRate, 0.15),
    conversionTopRate: clamp01(req.conversionTopRate, 0.12),
    terminalTaxRate: clamp01(req.terminalTaxRate, 0.24),
  });
}

export function runRetirement(req: RetirementRequest): SimulationResponse {
  const nSims = clampSims(req.nSims);
  const result = simulateRetirement({
    startingBalance: req.startingBalance,
    annualContribution: req.annualContribution,
    yearsToRetire: req.yearsToRetire,
    retirementYears: req.retirementYears,
    annualWithdrawal: req.annualWithdrawal,
    meanReturn: req.meanReturn,
    stdReturn: req.stdReturn,
    inflation: req.inflation ?? 0,
    nSims,
    seed: req.seed ?? null,
  });

  const unitPerStep = 1; // one step == one year already
  const bandsRaw = percentileBands(result.steps, result.stepValues);
  const bands = { ...bandsRaw, steps: [...result.steps] };

  const summary = summaryStats(result.terminal, req.startingBalance);
  // For retirement, "success" is not running out of money (terminal > 0).
  summary.successRate = result.successRate;

  return {
    model: "retirement",
    bands,
    histogram: terminalHistogram(result.terminal),
    summary,
    samplePaths: buildSamplePaths(result.steps, result.sampleStepValues, unitPerStep),
    xAxis: { label: "Year", unitPerStep, unit: "yr" },
    meta: {
      nSims,
      seed: req.seed ?? null,
      years: result.totalYears,
      beginningValue: req.startingBalance,
      successRate: result.successRate,
      yearsToRetire: result.yearsToRetire,
      totalYears: result.totalYears,
    },
  };
}
