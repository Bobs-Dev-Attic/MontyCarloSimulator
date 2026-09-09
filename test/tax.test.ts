import { describe, it, expect } from "vitest";
import { simulateTax, type TaxParams } from "@/lib/tax";

const FLAGSHIP: TaxParams = {
  startAge: 62,
  filing: "mfj",
  years: 30,
  taxable: 400_000,
  taxableBasisPct: 0.6,
  deferred: 1_200_000,
  roth: 150_000,
  annualSpend: 60_000,
  otherIncome: 30_000,
  nominalReturn: 0.06,
  inflation: 0.025,
  ltcgRate: 0.15,
  conversionTopRate: 0.12,
  terminalTaxRate: 0.24,
};

describe("simulateTax", () => {
  it("satisfies its headline identities", () => {
    const r = simulateTax(FLAGSHIP);
    expect(r.afterTaxGain).toBeCloseTo(
      r.smart.terminalAfterTax - r.naive.terminalAfterTax,
      6
    );
    expect(r.taxSaved).toBeCloseTo(r.naive.totalTax - r.smart.totalTax, 6);
  });

  it("keeps every account balance non-negative in both strategies", () => {
    const r = simulateTax(FLAGSHIP);
    for (const strat of [r.naive, r.smart]) {
      for (const row of strat.rows) {
        expect(row.taxable).toBeGreaterThanOrEqual(-1e-6);
        expect(row.deferred).toBeGreaterThanOrEqual(-1e-6);
        expect(row.roth).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it("takes no RMD before 73 and an RMD at 73+ while the IRA has a balance", () => {
    const r = simulateTax(FLAGSHIP);
    for (const row of r.naive.rows) {
      if (row.age < 73) expect(row.rmd).toBe(0);
    }
    const at73 = r.naive.rows.find((row) => row.age === 73);
    expect(at73).toBeDefined();
    expect(at73!.rmd).toBeGreaterThan(0);
  });

  it("only the smart strategy converts, moving money out of tax-deferred", () => {
    const r = simulateTax(FLAGSHIP);
    expect(r.naive.totalConversions).toBe(0);
    expect(r.smart.totalConversions).toBeGreaterThan(0);
    // Conversions shrink future RMDs.
    expect(r.smart.totalRMD).toBeLessThan(r.naive.totalRMD);
  });

  it("handles a $0 taxable account (no divide-by-zero; taxable stays 0)", () => {
    const r = simulateTax({ ...FLAGSHIP, taxable: 0 });
    for (const row of r.smart.rows) expect(row.taxable).toBeLessThanOrEqual(1e-6);
    expect(Number.isFinite(r.afterTaxGain)).toBe(true);
  });

  it("is deterministic (no RNG) and matches a locked regression value", () => {
    const a = simulateTax(FLAGSHIP);
    const b = simulateTax(FLAGSHIP);
    expect(a.afterTaxGain).toBe(b.afterTaxGain);
    // Regression guard: this is the app's flagship default scenario.
    expect(Math.round(a.afterTaxGain)).toBe(661_642);
    expect(Math.round(a.taxSaved)).toBe(65_004);
  });

  it("rejects a zero-year horizon", () => {
    expect(() => simulateTax({ ...FLAGSHIP, years: 0 })).toThrow();
  });
});
