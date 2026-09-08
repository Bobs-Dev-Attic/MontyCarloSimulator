/**
 * Risk-tolerance-over-time (glide path) simulation.
 *
 * The investor's risk tolerance is expressed as an allocation to a "risky"
 * sleeve (e.g. equities) versus a "safe" sleeve (e.g. bonds/cash) that changes
 * over the horizon — the classic target-date glide path. At each step we read
 * the risky weight a(t) off the glide path and simulate a continuously
 * rebalanced two-asset portfolio:
 *
 *   μ(t) = a·μ_risky + (1−a)·μ_safe
 *   σ(t) = √( a²σ_r² + (1−a)²σ_s² + 2a(1−a)ρ σ_r σ_s )
 *
 * then take one GBM step with that time-varying drift and volatility.
 */

import { Rng } from "./rng";

export interface Waypoint {
  year: number; // 0..horizon
  alloc: number; // risky allocation fraction 0..1
}

export interface GlidePathParams {
  riskyMu: number;
  riskySigma: number;
  safeMu: number;
  safeSigma: number;
  rho: number; // correlation between risky and safe sleeves
  waypoints: Waypoint[];
  beginningValue: number;
  years: number;
  annualContribution?: number;
  stepsPerYear?: number;
  nSims?: number;
  seed?: number | null;
}

export interface GlidePathResult {
  steps: number[];
  stepValues: Float64Array[];
  terminal: Float64Array;
  sampleStepValues: number[][];
  nSteps: number;
  startAlloc: number;
  endAlloc: number;
  // The realized glide curve for display: allocation & blended vol vs year.
  curve: { year: number; alloc: number; vol: number; mu: number }[];
}

/** Linear interpolation of the risky allocation at a given year. */
export function allocAtYear(waypoints: Waypoint[], year: number): number {
  if (waypoints.length === 0) return 0.6;
  const wp = [...waypoints].sort((a, b) => a.year - b.year);
  if (year <= wp[0].year) return clamp01(wp[0].alloc);
  if (year >= wp[wp.length - 1].year) return clamp01(wp[wp.length - 1].alloc);
  for (let i = 0; i < wp.length - 1; i++) {
    const a = wp[i];
    const b = wp[i + 1];
    if (year >= a.year && year <= b.year) {
      const f = b.year === a.year ? 0 : (year - a.year) / (b.year - a.year);
      return clamp01(a.alloc + f * (b.alloc - a.alloc));
    }
  }
  return clamp01(wp[wp.length - 1].alloc);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function blendedMuSigma(
  a: number,
  p: GlidePathParams
): { mu: number; sigma: number } {
  const mu = a * p.riskyMu + (1 - a) * p.safeMu;
  const variance =
    a * a * p.riskySigma * p.riskySigma +
    (1 - a) * (1 - a) * p.safeSigma * p.safeSigma +
    2 * a * (1 - a) * p.rho * p.riskySigma * p.safeSigma;
  return { mu, sigma: Math.sqrt(Math.max(0, variance)) };
}

function downsampleIndices(nPoints: number, maxPoints = 120): number[] {
  if (nPoints <= maxPoints) return Array.from({ length: nPoints }, (_, i) => i);
  const set = new Set<number>();
  for (let i = 0; i < maxPoints; i++) {
    set.add(Math.round((i * (nPoints - 1)) / (maxPoints - 1)));
  }
  return Array.from(set).sort((x, y) => x - y);
}

export function simulateGlidePath(params: GlidePathParams): GlidePathResult {
  const {
    beginningValue,
    years,
    annualContribution = 0,
    stepsPerYear = 12,
    nSims = 10_000,
    seed = null,
  } = params;

  if (beginningValue <= 0) throw new Error("beginningValue must be positive");
  if (years <= 0) throw new Error("years must be positive");

  const rng = new Rng(seed);
  const nSteps = Math.max(1, Math.round(years * stepsPerYear));
  const dt = 1.0 / stepsPerYear;
  const contribPerStep = annualContribution / stepsPerYear;

  // Precompute per-step drift/vol from the glide path (same for every sim).
  const driftArr = new Float64Array(nSteps);
  const volArr = new Float64Array(nSteps);
  const curve: GlidePathResult["curve"] = [];
  let curveNextYear = 0;
  for (let t = 1; t <= nSteps; t++) {
    const year = (t - 0.5) / stepsPerYear; // midpoint of the step
    const a = allocAtYear(params.waypoints, year);
    const { mu, sigma } = blendedMuSigma(a, params);
    driftArr[t - 1] = (mu - 0.5 * sigma * sigma) * dt;
    volArr[t - 1] = sigma * Math.sqrt(dt);
    // Sample the curve roughly yearly for display.
    if (year >= curveNextYear) {
      curve.push({ year: Math.round(year), alloc: a, vol: sigma, mu });
      curveNextYear += 1;
    }
  }

  const stepIdx = downsampleIndices(nSteps + 1, 120);
  const keep = new Set(stepIdx);
  const stepValues: Float64Array[] = stepIdx.map(() => new Float64Array(nSims));
  const nSample = Math.min(60, nSims);
  const sampleStepValues: number[][] = Array.from({ length: nSample }, () => []);
  const terminal = new Float64Array(nSims);

  for (let s = 0; s < nSims; s++) {
    let balance = beginningValue;
    let keepPos = 0;
    if (keep.has(0)) {
      stepValues[keepPos][s] = balance;
      if (s < nSample) sampleStepValues[s].push(balance);
      keepPos++;
    }
    for (let t = 1; t <= nSteps; t++) {
      const z = rng.standardNormal();
      balance = balance * Math.exp(driftArr[t - 1] + volArr[t - 1] * z) + contribPerStep;
      if (balance < 0) balance = 0;
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
    startAlloc: allocAtYear(params.waypoints, 0),
    endAlloc: allocAtYear(params.waypoints, years),
    curve,
  };
}
