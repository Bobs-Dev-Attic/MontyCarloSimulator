import { describe, it, expect } from "vitest";
import { encodeShareData, decodeShareData } from "@/lib/shareLink";

describe("shareLink encode/decode", () => {
  it("round-trips scenario data through a URL-safe payload", () => {
    const data = {
      "mcs.ui.tab": "tax",
      "mcs.tax.deferred": 1_200_000,
      "mcs.gbm.settings": { mu: 0.07, sigma: 0.15, years: 10 },
    };
    const payload = encodeShareData(data);
    // URL-safe: no characters that need escaping in a query value.
    expect(payload).toMatch(/^[A-Za-z0-9+\-$_.!*'()~]*$/);
    expect(decodeShareData(payload)).toEqual(data);
  });

  it("returns null for junk payloads", () => {
    expect(decodeShareData("!!!not-valid!!!")).toBeNull();
  });

  it("compresses repetitive data below the raw JSON size", () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) data[`mcs.view${i}.nSims`] = 10000;
    const payload = encodeShareData(data);
    expect(payload.length).toBeLessThan(JSON.stringify(data).length);
  });
});
