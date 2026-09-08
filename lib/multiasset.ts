/**
 * Correlated multi-asset portfolio simulation.
 *
 * Each asset follows its own Geometric Brownian Motion (its own mu/sigma), but
 * their random shocks are correlated through a correlation matrix. We generate
 * correlated standard normals by multiplying independent normals by the
 * Cholesky factor L of the correlation matrix (corr = L Lᵀ), so
 *   correlated = L · z,   z ~ N(0, I).
 *
 * The portfolio value is the sum of the assets, optionally rebalanced back to
 * the target weights each year. This is the classic setup that shows the
 * diversification benefit: the portfolio's volatility is lower than the
 * weighted average of the individual volatilities whenever assets aren't
 * perfectly correlated.
 */

import { Rng } from "./rng";

export interface Asset {
  id: string;
  name: string;
  mu: number; // expected annual return
  sigma: number; // annual volatility
  weight: number; // target portfolio weight (normalized internally)
}

export interface MultiAssetParams {
  assets: Asset[];
  corr: number[][]; // n x n correlation matrix (symmetric, unit diagonal)
  beginningValue: number;
  years: number;
  stepsPerYear?: number;
  nSims?: number;
  seed?: number | null;
  rebalance?: boolean; // rebalance to target weights annually
}

export interface MultiAssetResult {
  steps: number[];
  stepValues: Float64Array[];
  terminal: Float64Array;
  sampleStepValues: number[][];
  nSteps: number;
  // Deterministic portfolio analytics (from weights, sigmas, correlations):
  expectedReturn: number; // Σ w_i mu_i
  portfolioVol: number; // sqrt(wᵀ Σ w) — diversified
  undiversifiedVol: number; // Σ w_i sigma_i — the "if perfectly correlated" bound
}

/** Cholesky factorization (lower triangular). Regularizes tiny/negative
 * pivots so a slightly non-PSD user correlation matrix still yields a usable
 * factor instead of NaNs. */
export function cholesky(a: number[][]): number[][] {
  const n = a.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(sum, 1e-12));
      } else {
        L[i][j] = L[j][j] > 0 ? sum / L[j][j] : 0;
      }
    }
  }
  return L;
}

function downsampleIndices(nPoints: number, maxPoints = 120): number[] {
  if (nPoints <= maxPoints) return Array.from({ length: nPoints }, (_, i) => i);
  const set = new Set<number>();
  for (let i = 0; i < maxPoints; i++) {
    set.add(Math.round((i * (nPoints - 1)) / (maxPoints - 1)));
  }
  return Array.from(set).sort((x, y) => x - y);
}

export function simulateMultiAsset(params: MultiAssetParams): MultiAssetResult {
  const {
    assets,
    corr,
    beginningValue,
    years,
    stepsPerYear = 52,
    nSims = 10_000,
    seed = null,
    rebalance = false,
  } = params;

  if (assets.length === 0) throw new Error("at least one asset is required");
  if (beginningValue <= 0) throw new Error("beginningValue must be positive");
  if (years <= 0) throw new Error("years must be positive");

  const n = assets.length;
  const weightSum = assets.reduce((s, a) => s + Math.max(0, a.weight), 0) || 1;
  const w = assets.map((a) => Math.max(0, a.weight) / weightSum);

  const L = cholesky(corr);
  const rng = new Rng(seed);
  const nSteps = Math.max(1, Math.round(years * stepsPerYear));
  const dt = 1.0 / stepsPerYear;

  const drift = assets.map((a) => (a.mu - 0.5 * a.sigma * a.sigma) * dt);
  const vol = assets.map((a) => a.sigma * Math.sqrt(dt));

  const stepIdx = downsampleIndices(nSteps + 1, 120);
  const keep = new Set(stepIdx);
  const stepValues: Float64Array[] = stepIdx.map(() => new Float64Array(nSims));
  const nSample = Math.min(60, nSims);
  const sampleStepValues: number[][] = Array.from({ length: nSample }, () => []);
  const terminal = new Float64Array(nSims);

  const z = new Array(n).fill(0);
  const c = new Array(n).fill(0);
  const bal = new Array(n).fill(0);

  for (let s = 0; s < nSims; s++) {
    for (let a = 0; a < n; a++) bal[a] = beginningValue * w[a];
    let total = beginningValue;

    let keepPos = 0;
    if (keep.has(0)) {
      stepValues[keepPos][s] = total;
      if (s < nSample) sampleStepValues[s].push(total);
      keepPos++;
    }

    for (let t = 1; t <= nSteps; t++) {
      for (let a = 0; a < n; a++) z[a] = rng.standardNormal();
      // correlated shocks: c = L z
      for (let i = 0; i < n; i++) {
        let acc = 0;
        for (let j = 0; j <= i; j++) acc += L[i][j] * z[j];
        c[i] = acc;
      }
      total = 0;
      for (let a = 0; a < n; a++) {
        bal[a] *= Math.exp(drift[a] + vol[a] * c[a]);
        total += bal[a];
      }
      // Annual rebalance back to target weights.
      if (rebalance && t % stepsPerYear === 0) {
        for (let a = 0; a < n; a++) bal[a] = total * w[a];
      }
      if (keep.has(t)) {
        stepValues[keepPos][s] = total;
        if (s < nSample) sampleStepValues[s].push(total);
        keepPos++;
      }
    }
    terminal[s] = total;
  }

  // Deterministic analytics.
  const expectedReturn = assets.reduce((acc, a, i) => acc + w[i] * a.mu, 0);
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += w[i] * w[j] * assets[i].sigma * assets[j].sigma * corr[i][j];
    }
  }
  const portfolioVol = Math.sqrt(Math.max(0, variance));
  const undiversifiedVol = assets.reduce((acc, a, i) => acc + w[i] * a.sigma, 0);

  return {
    steps: stepIdx,
    stepValues,
    terminal,
    sampleStepValues,
    nSteps,
    expectedReturn,
    portfolioVol,
    undiversifiedVol,
  };
}
