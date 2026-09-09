import { describe, it, expect } from "vitest";
import {
  percentile,
  percentileBands,
  terminalHistogram,
  summaryStats,
} from "@/lib/aggregate";

describe("aggregate", () => {
  it("percentile matches known quantiles", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 100)).toBe(10);
    expect(percentile(xs, 50)).toBeGreaterThan(5);
    expect(percentile(xs, 50)).toBeLessThan(6);
  });

  it("percentileBands are monotonically ordered at each step", () => {
    const steps = [0, 1, 2];
    const stepValues = steps.map(
      (_, s) => new Float64Array(Array.from({ length: 500 }, (_, i) => i + s * 10))
    );
    const bands = percentileBands(steps, stepValues);
    for (let i = 0; i < steps.length; i++) {
      expect(bands.p5[i]).toBeLessThanOrEqual(bands.p25[i]);
      expect(bands.p25[i]).toBeLessThanOrEqual(bands.p50[i]);
      expect(bands.p50[i]).toBeLessThanOrEqual(bands.p75[i]);
      expect(bands.p75[i]).toBeLessThanOrEqual(bands.p95[i]);
    }
  });

  it("histogram counts sum to the number of samples", () => {
    const vals = new Float64Array(Array.from({ length: 1000 }, (_, i) => i));
    const h = terminalHistogram(vals, 20);
    const total = h.counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
    expect(h.edges.length).toBe(h.counts.length + 1);
  });

  it("summaryStats reports sensible scalars", () => {
    const vals = new Float64Array(Array.from({ length: 1001 }, (_, i) => i)); // 0..1000
    const s = summaryStats(vals, 500);
    expect(s.min).toBe(0);
    expect(s.max).toBe(1000);
    expect(s.median).toBeGreaterThan(490);
    expect(s.median).toBeLessThan(510);
    expect(s.probLoss).toBeGreaterThan(0.45);
    expect(s.probLoss).toBeLessThan(0.55); // ~half below 500
    expect(s.successRate).toBeGreaterThan(0.99); // all but one > 0
  });
});
