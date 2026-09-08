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

/**
 * Optional macro/geopolitical shock overlay (a jump-diffusion extension).
 *
 * On top of the normal GBM regime, discrete shocks strike with an annual
 * probability. Each shock is an instantaneous multiplicative drop; for a
 * recovery window afterwards, volatility is elevated (turbulence). This is
 * layered *on top of* the base mu/sigma — it only adds downside risk — plus an
 * optional persistent drift shift (e.g. a stagflation drag).
 */
export interface ShockConfig {
  annualProb: number; // probability of a shock in a given year (hazard)
  severityMean: number; // mean instantaneous drop, as a fraction (0..1)
  severityStd: number; // spread of the drop
  volMultiplier: number; // volatility multiplier during the recovery window
  recoveryYears: number; // length of the elevated-turbulence window after a shock
  annualDriftDelta?: number; // persistent shift to annual drift (e.g. -0.02)
}

/**
 * Return-distribution for the per-step shock. "normal" is standard GBM;
 * "t" uses a unit-variance Student-t (fat tails) with `nu` degrees of freedom —
 * lower nu ⇒ fatter tails (more extreme booms and crashes) while keeping the
 * same target volatility.
 */
export interface DistConfig {
  kind: "normal" | "t";
  nu?: number; // degrees of freedom for the Student-t (nu > 2)
}

export interface GbmParams {
  beginningValue: number;
  mu: number; // expected annual return (drift), e.g. 0.07
  sigma: number; // annual volatility, e.g. 0.15
  years: number;
  stepsPerYear?: number; // discretization granularity (252 = trading days)
  nSims?: number;
  contributionPerStep?: number; // optional cash added each step
  seed?: number | null;
  shock?: ShockConfig; // optional macro shock overlay
  dist?: DistConfig; // optional fat-tailed return distribution
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
  /** Shock diagnostics (present only when a shock overlay was applied). */
  shockStats?: {
    fracWithShock: number; // fraction of paths that saw >= 1 shock
    avgShocks: number; // average number of shocks per path
  };
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
    shock,
    dist,
  } = params;

  const useT = dist?.kind === "t";
  const nu = dist?.nu ?? 5;

  if (beginningValue <= 0) throw new Error("beginningValue must be positive");
  if (sigma < 0) throw new Error("sigma must be non-negative");
  if (years <= 0) throw new Error("years must be positive");

  const rng = new Rng(seed);
  const nSteps = Math.max(1, Math.round(years * stepsPerYear));
  const dt = 1.0 / stepsPerYear;
  const effMu = mu + (shock?.annualDriftDelta ?? 0);
  const drift = (effMu - 0.5 * sigma * sigma) * dt;
  const vol = sigma * Math.sqrt(dt);

  // Shock overlay setup: per-step hazard, recovery window in steps.
  const shockPerStep = shock ? 1 - Math.pow(1 - clamp01(shock.annualProb), dt) : 0;
  const recoverySteps = shock ? Math.round(shock.recoveryYears * stepsPerYear) : 0;
  let totalShocks = 0;
  let pathsWithShock = 0;

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
    let recoveryLeft = 0; // steps of elevated turbulence remaining
    let shocksThisPath = 0;
    // Record step 0 if kept.
    let keepPos = 0;
    if (keep.has(0)) {
      stepValues[keepPos][s] = balance;
      if (s < nSample) sampleStepValues[s].push(balance);
      keepPos++;
    }
    for (let t = 1; t <= nSteps; t++) {
      const z = useT ? rng.standardT(nu) : rng.standardNormal();
      // During a recovery window, volatility is elevated.
      const stepVol =
        shock && recoveryLeft > 0 ? vol * shock.volMultiplier : vol;
      let factor = Math.exp(drift + stepVol * z);
      if (recoveryLeft > 0) recoveryLeft--;
      // Macro shock: an instantaneous drop striking with per-step hazard.
      if (shock && rng.next() < shockPerStep) {
        const severity = clamp(
          rng.normal(shock.severityMean, shock.severityStd),
          0.005,
          0.95
        );
        factor *= 1 - severity;
        recoveryLeft = recoverySteps;
        shocksThisPath++;
      }
      balance = balance * factor + contributionPerStep;
      if (balance < 0) balance = 0;
      if (keep.has(t)) {
        stepValues[keepPos][s] = balance;
        if (s < nSample) sampleStepValues[s].push(balance);
        keepPos++;
      }
    }
    terminal[s] = balance;
    if (shocksThisPath > 0) pathsWithShock++;
    totalShocks += shocksThisPath;
  }

  return {
    steps: stepIdx,
    stepValues,
    terminal,
    sampleStepValues,
    nSteps,
    shockStats: shock
      ? { fracWithShock: pathsWithShock / nSims, avgShocks: totalShocks / nSims }
      : undefined,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function clamp01(x: number): number {
  return clamp(x, 0, 1);
}
