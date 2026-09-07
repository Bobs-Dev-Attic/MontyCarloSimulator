/**
 * Aggregate raw Monte Carlo paths into compact, chart-friendly summaries.
 *
 * Faithful TypeScript port of `functions/montecarlo/aggregate.py`. Sending
 * 10,000 raw paths to the browser is pointless; instead we return percentile
 * bands over time (a fan chart), a histogram of terminal values, and scalar
 * summary statistics.
 */

export const PERCENTILES = [5, 25, 50, 75, 95] as const;

/**
 * Linear-interpolation percentile matching NumPy's default ("linear") method,
 * so results line up with the original Python implementation.
 */
export function percentile(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const rank = (q / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function sortedCopy(values: Float64Array): Float64Array {
  const copy = Float64Array.from(values);
  copy.sort();
  return copy;
}

export interface PercentileBands {
  steps: number[];
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
}

/**
 * Percentile bands at each supplied time step. `stepValues[i]` holds every
 * simulation's value at step `steps[i]`.
 */
export function percentileBands(
  steps: number[],
  stepValues: Float64Array[]
): PercentileBands {
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];
  for (const values of stepValues) {
    const s = sortedCopy(values);
    p5.push(percentile(s, 5));
    p25.push(percentile(s, 25));
    p50.push(percentile(s, 50));
    p75.push(percentile(s, 75));
    p95.push(percentile(s, 95));
  }
  return { steps: [...steps], p5, p25, p50, p75, p95 };
}

export interface Histogram {
  counts: number[];
  edges: number[];
}

/** Histogram (counts + bin edges) of final outcomes, NumPy-style. */
export function terminalHistogram(
  terminalValues: Float64Array,
  bins = 40
): Histogram {
  const n = terminalValues.length;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = terminalValues[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min) || !isFinite(max)) return { counts: [], edges: [] };
  if (min === max) {
    // Degenerate: NumPy expands the range by 0.5 on each side.
    min -= 0.5;
    max += 0.5;
  }
  const edges: number[] = new Array(bins + 1);
  for (let i = 0; i <= bins; i++) {
    edges[i] = min + ((max - min) * i) / bins;
  }
  const counts = new Array(bins).fill(0);
  const width = max - min;
  for (let i = 0; i < n; i++) {
    const v = terminalValues[i];
    let b = Math.floor(((v - min) / width) * bins);
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1; // last bin is closed on the right
    counts[b]++;
  }
  return { counts, edges };
}

export interface SummaryStats {
  mean: number;
  median: number;
  p5: number;
  p95: number;
  min: number;
  max: number;
  probLoss: number;
  var95: number;
  successRate: number;
}

/** Scalar risk/return statistics from the terminal value distribution. */
export function summaryStats(
  terminalValues: Float64Array,
  beginningValue: number,
  successThreshold = 0.0
): SummaryStats {
  const n = terminalValues.length;
  const sorted = sortedCopy(terminalValues);
  let sum = 0;
  let lossCount = 0;
  let successCount = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = terminalValues[i];
    sum += v;
    if (v < beginningValue) lossCount++;
    if (v > successThreshold) successCount++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const p5 = percentile(sorted, 5);
  return {
    mean: sum / n,
    median: percentile(sorted, 50),
    p5,
    p95: percentile(sorted, 95),
    min,
    max,
    probLoss: lossCount / n,
    // 95% Value at Risk: the loss vs. starting value at the 5th percentile.
    var95: Math.max(0.0, beginningValue - p5),
    successRate: successCount / n,
  };
}
