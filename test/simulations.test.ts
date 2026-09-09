import { describe, it, expect } from "vitest";
import { simulateGbm } from "@/lib/gbm";
import { simulateRetirement } from "@/lib/retirement";

describe("simulateGbm", () => {
  const base = {
    beginningValue: 10_000,
    mu: 0.07,
    sigma: 0.15,
    years: 10,
    nSims: 2_000,
    seed: 2026,
  };

  it("is deterministic for a fixed seed", () => {
    const a = simulateGbm(base);
    const b = simulateGbm(base);
    expect(Array.from(a.terminal)).toEqual(Array.from(b.terminal));
  });

  it("returns one terminal value per simulation and downsampled steps", () => {
    const r = simulateGbm(base);
    expect(r.terminal.length).toBe(base.nSims);
    // Steps are downsampled to a bounded number of points for the fan chart.
    expect(r.steps.length).toBeLessThanOrEqual(121);
    expect(r.stepValues.length).toBe(r.steps.length);
  });

  it("keeps balances non-negative", () => {
    const r = simulateGbm({ ...base, mu: -0.1, sigma: 0.5 });
    for (const v of r.terminal) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("simulateRetirement", () => {
  const base = {
    startingBalance: 100_000,
    annualContribution: 15_000,
    yearsToRetire: 25,
    retirementYears: 30,
    annualWithdrawal: 60_000,
    meanReturn: 0.06,
    stdReturn: 0.12,
    inflation: 0.025,
    nSims: 3_000,
    seed: 2026,
  };

  it("is deterministic for a fixed seed", () => {
    const a = simulateRetirement(base);
    const b = simulateRetirement(base);
    expect(a.successRate).toBe(b.successRate);
    expect(Array.from(a.terminal)).toEqual(Array.from(b.terminal));
  });

  it("reports a success rate in [0, 1] and covers the full horizon", () => {
    const r = simulateRetirement(base);
    expect(r.successRate).toBeGreaterThanOrEqual(0);
    expect(r.successRate).toBeLessThanOrEqual(1);
    expect(r.totalYears).toBe(base.yearsToRetire + base.retirementYears);
  });

  it("higher withdrawals never improve the success rate", () => {
    const low = simulateRetirement({ ...base, annualWithdrawal: 40_000 });
    const high = simulateRetirement({ ...base, annualWithdrawal: 120_000 });
    expect(high.successRate).toBeLessThanOrEqual(low.successRate);
  });
});
