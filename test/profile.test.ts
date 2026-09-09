import { describe, it, expect } from "vitest";
import { parseProfile, PROFILE_FORMAT, PROFILE_VERSION } from "@/lib/profile";

function profileText(data: Record<string, unknown>): string {
  return JSON.stringify({
    format: PROFILE_FORMAT,
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  });
}

describe("parseProfile", () => {
  it("accepts a valid profile", () => {
    const { profile, warnings } = parseProfile(
      profileText({ "mcs.gbm.settings": { mu: 0.07 } })
    );
    expect(profile.data["mcs.gbm.settings"]).toEqual({ mu: 0.07 });
    expect(warnings).toEqual([]);
  });

  it("rejects a non-profile file", () => {
    expect(() => parseProfile(JSON.stringify({ hello: "world" }))).toThrow();
    expect(() => parseProfile("not json")).toThrow();
  });

  it("blocks prototype-pollution keys", () => {
    const { profile, warnings } = parseProfile(
      profileText({
        "mcs.__proto__.polluted": true,
        "mcs.constructor.x": 1,
        "mcs.gbm.settings": { mu: 0.05 },
      })
    );
    expect(Object.keys(profile.data)).toEqual(["mcs.gbm.settings"]);
    expect(warnings.some((w) => /unsafe/.test(w))).toBe(true);
  });

  it("drops foreign (non-mcs) keys", () => {
    const { profile, warnings } = parseProfile(
      profileText({ evil: 1, "mcs.real.enabled": true })
    );
    expect(Object.keys(profile.data)).toEqual(["mcs.real.enabled"]);
    expect(warnings.some((w) => /belong/.test(w))).toBe(true);
  });

  it("rejects an over-large file", () => {
    const huge = "x".repeat(2_000_001);
    expect(() => parseProfile(profileText({ "mcs.a": huge }))).toThrow(/too large/i);
  });

  it("skips oversized individual values", () => {
    const big = "y".repeat(300_000);
    const { profile, warnings } = parseProfile(
      profileText({ "mcs.big": big, "mcs.ok": 1 })
    );
    expect(profile.data["mcs.ok"]).toBe(1);
    expect(profile.data["mcs.big"]).toBeUndefined();
    expect(warnings.some((w) => /oversized|excess/i.test(w))).toBe(true);
  });

  it("caps the number of keys", () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < 600; i++) data[`mcs.k${i}`] = i;
    const { profile, warnings } = parseProfile(profileText(data));
    expect(Object.keys(profile.data).length).toBe(500);
    expect(warnings.some((w) => /oversized|excess/i.test(w))).toBe(true);
  });
});
