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
import { DEFAULTS } from "./defaults";
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
  const d = DEFAULTS.dyn;
  const nSims = Math.min(clampSims(req.nSims ?? d.nSims), 20_000);
  return simulateDynamicWithdrawal({
    startingBalance: req.startingBalance ?? d.startingBalance,
    retirementYears: Math.round(req.retirementYears ?? d.retirementYears),
    initialRate: req.initialRate ?? d.initialRate,
    meanReturn: req.meanReturn ?? d.meanReturn,
    stdReturn: req.stdReturn ?? d.stdReturn,
    inflation: req.inflation ?? d.inflation,
    guardBand: req.guardBand ?? d.guardBand,
    guardAdjust: req.guardAdjust ?? d.guardAdjust,
    ratchetThreshold: req.ratchetThreshold ?? d.ratchetThreshold,
    ratchetStep: req.ratchetStep ?? d.ratchetStep,
    ratchetEvery: Math.round(req.ratchetEvery ?? d.ratchetEvery),
    nSims,
    seed: req.seed ?? null,
  });
}

export function runSequenceRisk(
  req: Partial<SequenceRiskParams>
): SequenceRiskResult {
  const d = DEFAULTS.seqrisk;
  const nSims = Math.min(clampSims(req.nSims ?? d.nSims), 15_000);
  return simulateSequenceRisk({
    startingBalance: req.startingBalance ?? d.startingBalance,
    retirementYears: Math.round(req.retirementYears ?? d.retirementYears),
    annualSpend: req.annualSpend ?? d.annualSpend,
    inflation: req.inflation ?? d.inflation,
    equityMean: req.equityMean ?? d.equityMean,
    equityVol: req.equityVol ?? d.equityVol,
    bufferYield: req.bufferYield ?? d.bufferYield,
    bearYears: Math.round(req.bearYears ?? d.bearYears),
    bearMean: req.bearMean ?? d.bearMean,
    bearVol: req.bearVol ?? d.bearVol,
    troughDrawdown: req.troughDrawdown ?? d.troughDrawdown,
    refillBuffer: req.refillBuffer ?? d.refillBuffer,
    maxBufferYears: Math.round(req.maxBufferYears ?? d.maxBufferYears),
    targetSellProb: req.targetSellProb ?? d.targetSellProb,
    nSims,
    seed: req.seed ?? null,
  });
}

export function runLongevity(req: Partial<LongevityParams>): LongevityResult {
  const d = DEFAULTS.longevity;
  const sex = (s: unknown, def: Sex): Sex => (s === "male" || s === "female" ? s : def);
  return simulateLongevity({
    ageA: Math.round(req.ageA ?? d.ageA),
    sexA: sex(req.sexA, d.sexA),
    couple: Boolean(req.couple),
    ageB: Math.round(req.ageB ?? d.ageB),
    sexB: sex(req.sexB, d.sexB),
    longevityAdj: req.longevityAdj ?? d.longevityAdj,
    startingBalance: req.startingBalance ?? d.startingBalance,
    annualSpend: req.annualSpend ?? d.annualSpend,
    realReturn: req.realReturn ?? d.realReturn,
    vol: req.vol ?? d.vol,
    survivorSpend: req.survivorSpend ?? d.survivorSpend,
    nSims: Math.min(Math.max(1000, Math.round(req.nSims ?? d.nSims)), 50_000),
    seed: req.seed ?? null,
  });
}

export function runCareCosts(req: Partial<CareParams>): CareResult {
  const d = DEFAULTS.care;
  return simulateCareCosts({
    startAge: Math.round(req.startAge ?? d.startAge),
    startingBalance: req.startingBalance ?? d.startingBalance,
    baseSpend: req.baseSpend ?? d.baseSpend,
    realReturn: req.realReturn ?? d.realReturn,
    vol: req.vol ?? d.vol,
    actToAssisted: req.actToAssisted ?? d.actToAssisted,
    actToSkilled: req.actToSkilled ?? d.actToSkilled,
    actToDead: req.actToDead ?? d.actToDead,
    asstToSkilled: req.asstToSkilled ?? d.asstToSkilled,
    asstToDead: req.asstToDead ?? d.asstToDead,
    asstToActive: req.asstToActive ?? d.asstToActive,
    skilledToDead: req.skilledToDead ?? d.skilledToDead,
    ageRamp: req.ageRamp ?? d.ageRamp,
    assistedCost: req.assistedCost ?? d.assistedCost,
    skilledCost: req.skilledCost ?? d.skilledCost,
    nSims: Math.min(Math.max(1000, Math.round(req.nSims ?? d.nSims)), 50_000),
    seed: req.seed ?? null,
  });
}

export function runTax(req: Partial<TaxParams>): TaxResult {
  const d = DEFAULTS.tax;
  const filing: Filing = req.filing === "mfj" ? "mfj" : req.filing === "single" ? "single" : d.filing;
  const clamp01 = (v: number | undefined, def: number) =>
    Math.min(1, Math.max(0, v ?? def));
  return simulateTax({
    startAge: Math.round(req.startAge ?? d.startAge),
    filing,
    years: Math.min(50, Math.max(1, Math.round(req.years ?? d.years))),
    taxable: Math.max(0, req.taxable ?? d.taxable),
    taxableBasisPct: clamp01(req.taxableBasisPct, d.taxableBasisPct),
    deferred: Math.max(0, req.deferred ?? d.deferred),
    roth: Math.max(0, req.roth ?? d.roth),
    annualSpend: Math.max(0, req.annualSpend ?? d.annualSpend),
    otherIncome: Math.max(0, req.otherIncome ?? d.otherIncome),
    nominalReturn: req.nominalReturn ?? d.nominalReturn,
    inflation: req.inflation ?? d.inflation,
    ltcgRate: clamp01(req.ltcgRate, d.ltcgRate),
    conversionTopRate: clamp01(req.conversionTopRate, d.conversionTopRate),
    terminalTaxRate: clamp01(req.terminalTaxRate, d.terminalTaxRate),
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
