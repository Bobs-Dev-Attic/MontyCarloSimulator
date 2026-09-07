/**
 * Geometric Brownian Motion (GBM) path simulation.
 *
 * Models the value of a portfolio or asset as:
 *
 *     S_{t+1} = S_t * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
 *
 * where Z ~ N(0, 1). This is a faithful TypeScript port of the project's
 * `functions/montecarlo/gbm.py`.
 */

import { Rng } from "./rng";

export interface GbmParams {
  beginningValue: number;
  mu: number; // expected annual return (drift), e.g. 0.07
  sigma: number; // annual volatility, e.g. 0.15
  years: number;
  stepsPerYear?: number; // discretization granularity (252 = trading days)
  nSims?: number;
  contributionPerStep?: number; // optional cash added each step
  seed?: number | null;
}

/**
 * Result of a GBM run. To keep memory bounded we do NOT retain every full
 * path; instead we accumulate, per time step, the values needed downstream:
 *   - `stepValues`: the per-simulation values at each *downsampled* step
 *     (used for percentile bands / the fan chart),
 *   - `terminal`: the terminal value of every path (used for the histogram
 *     and summary statistics),
 *   - `samplePaths`: a small number of full example trajectories for display.
 */
export interface GbmResult {
  steps: number[]; // downsampled step indices
  stepValues: Float64Array[]; // one array (over sims) per downsampled step
  terminal: Float64Array;
  sampleStepValues: number[][]; // [sampleIndex][downsampledStep] example paths
  nSteps: number;
}

function downsampleIndices(nPoints: number, maxPoints = 120): number[] {
  if (nPoints <= maxPoints) {
    return Array.from({ length: nPoints }, (_, i) => i);
  }
  const set = new Set<number>();
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (nPoints - 1)) / (maxPoints - 1));
    set.add(idx);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function simulateGbm(params: GbmParams): GbmResult {
  const {
    beginningValue,
    mu,
    sigma,
    years,
    stepsPerYear = 252,
    nSims = 10_000,
    contributionPerStep = 0.0,
    seed = null,
  } = params;

  if (beginningValue <= 0) throw new Error("beginningValue must be positive");
  if (sigma < 0) throw new Error("sigma must be non-negative");
  if (years <= 0) throw new Error("years must be positive");

  const rng = new Rng(seed);
  const nSteps = Math.max(1, Math.round(years * stepsPerYear));
  const dt = 1.0 / stepsPerYear;
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);

  const stepIdx = downsampleIndices(nSteps + 1, 120);
  const keep = new Set(stepIdx);
  const stepValues: Float64Array[] = stepIdx.map(() => new Float64Array(nSims));

  const nSample = Math.min(60, nSims);
  const sampleStepValues: number[][] = Array.from({ length: nSample }, () => []);

  const terminal = new Float64Array(nSims);

  // Iterate per simulation to keep memory O(nSteps of interest) instead of
  // materializing the whole (nSteps x nSims) matrix.
  for (let s = 0; s < nSims; s++) {
    let balance = beginningValue;
    // Record step 0 if kept.
    let keepPos = 0;
    if (keep.has(0)) {
      stepValues[keepPos][s] = balance;
      if (s < nSample) sampleStepValues[s].push(balance);
      keepPos++;
    }
    for (let t = 1; t <= nSteps; t++) {
      const z = rng.standardNormal();
      const factor = Math.exp(drift + vol * z);
      balance = balance * factor + contributionPerStep;
      if (keep.has(t)) {
        stepValues[keepPos][s] = balance;
        if (s < nSample) sampleStepValues[s].push(balance);
        keepPos++;
      }
    }
    terminal[s] = balance;
  }

  return {
    steps: stepIdx,
    stepValues,
    terminal,
    sampleStepValues,
    nSteps,
  };
}
