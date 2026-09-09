import { describe, it, expect } from "vitest";
import { TaxRequestSchema, SequenceRiskRequestSchema } from "@/lib/schemas";
import { DEFAULTS } from "@/lib/defaults";

describe("request schemas", () => {
  it("coerces numeric strings", () => {
    const r = TaxRequestSchema.safeParse({ taxable: "400000", deferred: "1200000" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.taxable).toBe(400000);
      expect(r.data.deferred).toBe(1200000);
    }
  });

  it("accepts an empty body (all fields optional)", () => {
    const r = TaxRequestSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.taxable).toBeUndefined();
  });

  it("treats null/empty-string as absent", () => {
    const r = TaxRequestSchema.safeParse({ taxable: null, deferred: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.taxable).toBeUndefined();
      expect(r.data.deferred).toBeUndefined();
    }
  });

  it("rejects a non-object body and non-numeric values", () => {
    expect(TaxRequestSchema.safeParse([1, 2, 3]).success).toBe(false);
    expect(TaxRequestSchema.safeParse("nope").success).toBe(false);
    expect(TaxRequestSchema.safeParse({ taxable: "abc" }).success).toBe(false);
  });

  it("validates enum fields and strips unknown keys", () => {
    expect(TaxRequestSchema.safeParse({ filing: "mfj" }).success).toBe(true);
    expect(TaxRequestSchema.safeParse({ filing: "xx" }).success).toBe(false);
    const r = TaxRequestSchema.safeParse({ taxable: 1, bogus: 99 });
    expect(r.success).toBe(true);
    if (r.success) expect("bogus" in r.data).toBe(false);
  });

  it("coerces booleans (sequence-risk refillBuffer)", () => {
    const r = SequenceRiskRequestSchema.safeParse({ refillBuffer: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.refillBuffer).toBe(false);
  });
});

describe("DEFAULTS", () => {
  it("holds the canonical view defaults", () => {
    expect(DEFAULTS.tax.taxable).toBe(0);
    expect(DEFAULTS.tax.deferred).toBe(1_200_000);
    expect(DEFAULTS.seqrisk.nSims).toBe(6_000);
    expect(DEFAULTS.dyn.nSims).toBe(8_000);
  });
});
