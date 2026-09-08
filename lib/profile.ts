"use client";

import { PERSIST_PREFIX } from "./persist";
import { categoryForKey } from "./profileCategories";

/**
 * A Profile is a snapshot of persisted app settings (localStorage keys under the
 * `mcs.` prefix — inputs for every tab, preferences/theme, and simulation
 * history). It can be exported to a JSON file and imported on another
 * device/browser, and both directions let the user choose which categories to
 * include.
 */

export const PROFILE_FORMAT = "monty-carlo-profile";
export const PROFILE_VERSION = 1;

/** Reject keys that could pollute Object.prototype when written back. */
const DANGEROUS_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export interface ProfileFile {
  format: string;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/**
 * Gather persisted settings into a single object. When `categoryIds` is given,
 * only keys belonging to those categories are included.
 */
export function collectSettings(categoryIds?: string[]): Record<string, unknown> {
  const allow = categoryIds ? new Set(categoryIds) : null;
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PERSIST_PREFIX)) continue;
      if (allow && !allow.has(categoryForKey(k))) continue;
      const raw = localStorage.getItem(k);
      if (raw === null) continue;
      try {
        out[k] = JSON.parse(raw);
      } catch {
        out[k] = raw;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return out;
}

export function buildProfile(categoryIds?: string[]): ProfileFile {
  return {
    format: PROFILE_FORMAT,
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectSettings(categoryIds),
  };
}

export function downloadProfile(categoryIds?: string[], name?: string): void {
  const profile = buildProfile(categoryIds);
  const text = JSON.stringify(profile, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${name?.trim() || "monty-carlo-profile"}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ParsedProfile {
  profile: ProfileFile;
  /** Non-fatal notes surfaced to the user (foreign/blocked keys, newer version). */
  warnings: string[];
}

/**
 * Parse and *examine* a profile file's text. Throws with a clear message if the
 * file isn't a valid Monty Carlo profile. Sanitizes the settings map: keeps only
 * `mcs.`-prefixed keys, drops prototype-polluting keys and non-JSON values, and
 * reports what it skipped. The returned profile is safe to hand to
 * `applyProfile`.
 */
export function parseProfile(text: string): ParsedProfile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("This file isn't a Monty Carlo profile.");
  }
  const p = json as Record<string, unknown>;
  if (p.format !== PROFILE_FORMAT) {
    throw new Error("This file isn't a Monty Carlo profile (unexpected format tag).");
  }
  const version = typeof p.version === "number" && Number.isFinite(p.version) ? p.version : 0;
  if (version < 1) {
    throw new Error("Unrecognized profile version.");
  }
  if (typeof p.data !== "object" || p.data === null || Array.isArray(p.data)) {
    throw new Error("Profile file has no settings block.");
  }

  const warnings: string[] = [];
  if (version > PROFILE_VERSION) {
    warnings.push(`Created by a newer version (v${version}); unknown fields are ignored.`);
  }

  const clean: Record<string, unknown> = {};
  let foreign = 0;
  let blocked = 0;
  for (const [k, v] of Object.entries(p.data as Record<string, unknown>)) {
    if (!k.startsWith(PERSIST_PREFIX)) {
      foreign++;
      continue;
    }
    const bare = k.slice(PERSIST_PREFIX.length);
    if (bare.split(".").some((seg) => DANGEROUS_SEGMENTS.has(seg))) {
      blocked++;
      continue;
    }
    // Only plain JSON values are storable; functions/symbols/bigint can't appear
    // in parsed JSON, but guard anyway.
    const t = typeof v;
    if (t === "function" || t === "symbol" || t === "bigint") {
      foreign++;
      continue;
    }
    clean[k] = v;
  }

  if (Object.keys(clean).length === 0) {
    throw new Error("This profile doesn't contain any recognizable settings.");
  }
  if (foreign > 0) {
    warnings.push(`Ignored ${foreign} entr${foreign === 1 ? "y" : "ies"} that don't belong to this app.`);
  }
  if (blocked > 0) {
    warnings.push(`Blocked ${blocked} unsafe key${blocked === 1 ? "" : "s"}.`);
  }

  return {
    profile: {
      format: PROFILE_FORMAT,
      version,
      exportedAt: typeof p.exportedAt === "string" ? p.exportedAt : "",
      data: clean,
    },
    warnings,
  };
}

/**
 * Apply a parsed profile. When `categoryIds` is given, only those categories are
 * imported — and only existing keys in those same categories are cleared first
 * (a targeted replace, so importing "theme" won't wipe your history). With no
 * selection, every category in the file replaces the matching local settings.
 * Returns the number of keys written.
 */
export function applyProfile(profile: ProfileFile, categoryIds?: string[]): number {
  if (!profile || profile.format !== PROFILE_FORMAT || typeof profile.data !== "object" || profile.data === null) {
    throw new Error("Not a valid Monty Carlo profile.");
  }
  const allow = categoryIds ? new Set(categoryIds) : null;

  const entries = Object.entries(profile.data).filter(([k]) => {
    if (!k.startsWith(PERSIST_PREFIX)) return false;
    const bare = k.slice(PERSIST_PREFIX.length);
    if (bare.split(".").some((seg) => DANGEROUS_SEGMENTS.has(seg))) return false;
    return allow ? allow.has(categoryForKey(k)) : true;
  });

  try {
    // Clear existing keys that fall in the categories we're importing.
    const existing: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERSIST_PREFIX)) existing.push(k);
    }
    for (const k of existing) {
      if (!allow || allow.has(categoryForKey(k))) localStorage.removeItem(k);
    }

    let count = 0;
    for (const [k, v] of entries) {
      localStorage.setItem(k, JSON.stringify(v));
      count++;
    }
    return count;
  } catch {
    throw new Error("Could not write settings to local storage.");
  }
}

/** Remove all persisted app settings. */
export function clearAllSettings(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERSIST_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
