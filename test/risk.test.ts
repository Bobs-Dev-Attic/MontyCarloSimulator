import { describe, it, expect } from "vitest";
import { simulateSequenceRisk, type SequenceRiskParams } from "@/lib/sequenceRisk";
import { simulateLongevity, type LongevityParams } from "@/lib/mortality";
import { simulateCareCosts, type CareParams } from "@/lib/careCosts";

const isProb = (x: number) => x >= 0 && x <= 1;

describe("simulateSequenceRisk", () => {
  const base: SequenceRiskParams = {
    startingBalance: 1_000_000,
    retirementYears: 30,
    annualSpend: 35_000,
    inflation: 0.025,
    equityMean: 0.07,
    equityVol: 0.16,
    bufferYield: 0.03,
    bearYears: 3,
    bearMean: -0.05,
    bearVol: 0.2,
    troughDrawdown: 0.1,
    refillBuffer: true,
    maxBufferYears: 8,
    targetSellProb: 0.05,
    nSims: 3_000,
    seed: 2026,
  };

  it("returns probabilities within [0,1] across the sweep", () => {
    const r = simulateSequenceRisk(base);
    for (const p of r.sweep) {
      expect(isProb(p.sellProb)).toBe(true);
      expect(isProb(p.ruinProb)).toBe(true);
      expect(p.bufferYears).toBeGreaterThanOrEqual(0);
    }
    expect(r.sweep.length).toBe(base.maxBufferYears + 1);
  });

  it("the recommended buffer meets the trough-sale target", () => {
    const r = simulateSequenceRisk(base);
    if (r.recommended) {
      expect(r.recommended.sellProb).toBeLessThanOrEqual(base.targetSellProb + 1e-9);
      expect(r.recommendedBufferYears).not.toBeNull();
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = simulateSequenceRisk(base);
    const b = simulateSequenceRisk(base);
    expect(a.sweep.map((p) => p.ruinProb)).toEqual(b.sweep.map((p) => p.ruinProb));
  });
});

describe("simulateLongevity", () => {
  const base: LongevityParams = {
    ageA: 65,
    sexA: "male",
    couple: true,
    ageB: 63,
    sexB: "female",
    longevityAdj: 0,
    startingBalance: 1_000_000,
    annualSpend: 45_000,
    realReturn: 0.035,
    vol: 0.1,
    survivorSpend: 0.75,
    nSims: 5_000,
    seed: 2026,
  };

  it("produces a non-increasing survival curve and valid probabilities", () => {
    const r = simulateLongevity(base);
    for (let i = 1; i < r.survivalA.length; i++) {
      expect(r.survivalA[i]).toBeLessThanOrEqual(r.survivalA[i - 1] + 1e-9);
    }
    expect(isProb(r.ruinMortality)).toBe(true);
    for (const t of r.tail) {
      expect(isProb(t.a)).toBe(true);
      if (t.either != null) expect(isProb(t.either)).toBe(true);
    }
  });

  it("joint 'either alive' is at least each individual's survival", () => {
    const r = simulateLongevity(base);
    if (r.survivalEither && r.survivalB) {
      for (let i = 0; i < r.survivalEither.length; i++) {
        expect(r.survivalEither[i]).toBeGreaterThanOrEqual(r.survivalA[i] - 1e-9);
        expect(r.survivalEither[i]).toBeGreaterThanOrEqual(r.survivalB[i] - 1e-9);
      }
    }
  });
});

describe("simulateCareCosts", () => {
  const base: CareParams = {
    startAge: 65,
    startingBalance: 1_000_000,
    baseSpend: 45_000,
    realReturn: 0.035,
    vol: 0.1,
    actToAssisted: 0.03,
    actToSkilled: 0.005,
    actToDead: 0.012,
    asstToSkilled: 0.1,
    asstToDead: 0.08,
    asstToActive: 0.05,
    skilledToDead: 0.25,
    ageRamp: 0.05,
    assistedCost: 60_000,
    skilledCost: 110_000,
    nSims: 5_000,
    seed: 2026,
  };

  it("occupancy fractions sum to ~1 each year and probabilities are valid", () => {
    const r = simulateCareCosts(base);
    for (let i = 0; i < r.occupancy.active.length; i++) {
      const sum =
        r.occupancy.active[i] +
        r.occupancy.assisted[i] +
        r.occupancy.skilled[i] +
        r.occupancy.dead[i];
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    }
    expect(isProb(r.probEverCare)).toBe(true);
    expect(isProb(r.ruinWithCare)).toBe(true);
    expect(isProb(r.ruinNoCare)).toBe(true);
  });

  it("care costs do not reduce ruin risk (with care >= without, on common paths)", () => {
    const r = simulateCareCosts(base);
    expect(r.ruinWithCare).toBeGreaterThanOrEqual(r.ruinNoCare - 1e-9);
  });
});
