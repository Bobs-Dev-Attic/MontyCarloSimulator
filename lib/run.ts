/**
 * Orchestration layer: run a model, aggregate it, and shape the compact JSON
 * response the browser consumes. Kept separate from the API route so it can be
 * unit-tested and reused.
 */

import { simulateGbm, type ShockConfig } from "./gbm";
import { simulateRetirement } from "./retirement";
import { simulateMultiAsset, type Asset } from "./multiasset";
import {
  percentileBands,
  terminalHistogram,
  summaryStats,
} from "./aggregate";
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
      rebalance: req.rebalance ?? false,
      expectedReturn: result.expectedReturn,
      portfolioVol: result.portfolioVol,
      undiversifiedVol: result.undiversifiedVol,
      diversificationBenefit: result.undiversifiedVol - result.portfolioVol,
    },
  };
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
      successRate: result.successRate,
      yearsToRetire: result.yearsToRetire,
      totalYears: result.totalYears,
    },
  };
}
