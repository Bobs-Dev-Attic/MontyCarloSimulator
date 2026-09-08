/**
 * Convert a nominal simulation result into real (inflation-adjusted) terms —
 * today's purchasing power.
 *
 * Inflation here is a fixed annual rate, so deflating value at time t by
 * (1+π)^t is a deterministic, monotonic transform. That means percentile bands,
 * the terminal histogram, and summary percentiles can all be deflated directly
 * (the percentile of a monotonic transform equals the transform of the
 * percentile). Probabilities (prob-of-loss, success rate) are invariant because
 * the comparison threshold deflates by the same factor.
 */

import type { SimulationResponse } from "./types";

export function deflateResponse(
  resp: SimulationResponse,
  inflation: number
): SimulationResponse {
  if (!inflation || inflation <= 0) return resp;

  const years = (resp.meta.years as number) ?? resp.bands.steps[resp.bands.steps.length - 1] ?? 0;
  const terminalFactor = Math.pow(1 + inflation, years);
  const beginning = resp.meta.beginningValue as number | undefined;

  const perStep = (arr: number[]) =>
    arr.map((v, i) => v / Math.pow(1 + inflation, resp.bands.steps[i]));

  const bands = {
    steps: resp.bands.steps,
    p5: perStep(resp.bands.p5),
    p25: perStep(resp.bands.p25),
    p50: perStep(resp.bands.p50),
    p75: perStep(resp.bands.p75),
    p95: perStep(resp.bands.p95),
  };

  const realP5 = resp.summary.p5 / terminalFactor;
  const summary = {
    ...resp.summary,
    mean: resp.summary.mean / terminalFactor,
    median: resp.summary.median / terminalFactor,
    p5: realP5,
    p95: resp.summary.p95 / terminalFactor,
    min: resp.summary.min / terminalFactor,
    max: resp.summary.max / terminalFactor,
    // Real VaR: loss vs. today's starting capital (not deflated at t0).
    var95:
      typeof beginning === "number"
        ? Math.max(0, beginning - realP5)
        : resp.summary.var95 / terminalFactor,
    // Probabilities are unchanged by a common deflation factor.
    probLoss: resp.summary.probLoss,
    successRate: resp.summary.successRate,
  };

  const histogram = {
    counts: resp.histogram.counts,
    edges: resp.histogram.edges.map((e) => e / terminalFactor),
  };

  const samplePaths = resp.samplePaths.map((sp) => ({
    steps: sp.steps,
    values: sp.values.map((v, i) => v / Math.pow(1 + inflation, sp.steps[i])),
  }));

  return {
    ...resp,
    bands,
    summary,
    histogram,
    samplePaths,
    meta: { ...resp.meta, real: true, realInflation: inflation },
  };
}
