"use client";

import LZString from "lz-string";
import { PERSIST_PREFIX } from "./persist";
import { collectSettings } from "./profile";
import { categoryForKey } from "./profileCategories";

/**
 * Shareable scenario links: encode the current inputs into a compressed URL
 * param so a scenario can be shared or bookmarked, and apply one back on load.
 *
 * We share the scenario (all view inputs, the active view, and display options)
 * but deliberately NOT the recipient's theme/preferences or run history — a link
 * shouldn't overwrite someone's personal setup or dump a stranger's history.
 */

const PARAM = "s";
const DANGEROUS = new Set(["__proto__", "prototype", "constructor"]);
const EXCLUDE_CATEGORIES = new Set(["history", "theme"]);
const MAX_KEYS = 200;
const MAX_VALUE_BYTES = 64_000;

/** Build a shareable URL for the current settings (call from a click handler). */
export function buildShareUrl(): string {
  const all = collectSettings();
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) {
    if (EXCLUDE_CATEGORIES.has(categoryForKey(k))) continue;
    data[k] = v;
  }
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(data));
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?${PARAM}=${payload}`;
}

/** True if the current URL carries a shared scenario. */
export function hasShareParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(PARAM);
}

/**
 * If the URL carries a shared scenario, validate and write it to localStorage.
 * Returns true if at least one key was applied. The caller should then reload so
 * the persisted-state hooks pick up the new values. Untrusted input is treated
 * exactly like an imported profile (mcs.-prefix only, no prototype-pollution
 * keys, size-capped).
 */
export function applyShareFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const s = new URLSearchParams(window.location.search).get(PARAM);
  if (!s) return false;
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return false;
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;

    let wrote = 0;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (wrote >= MAX_KEYS) break;
      if (!k.startsWith(PERSIST_PREFIX)) continue;
      const bare = k.slice(PERSIST_PREFIX.length);
      if (bare.split(".").some((seg) => DANGEROUS.has(seg))) continue;
      const t = typeof v;
      if (t === "function" || t === "symbol" || t === "bigint") continue;
      let ser: string;
      try {
        ser = JSON.stringify(v);
      } catch {
        continue;
      }
      if (!ser || ser.length > MAX_VALUE_BYTES) continue;
      try {
        window.localStorage.setItem(k, ser);
        wrote++;
      } catch {
        // localStorage unavailable
      }
    }
    return wrote > 0;
  } catch {
    return false;
  }
}

/** Remove the share param from the address bar without a reload. */
export function stripShareParam(): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    // ignore
  }
}

/**
 * Encode/decode helpers exposed for testing (pure, no DOM).
 */
export function encodeShareData(data: Record<string, unknown>): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(data));
}
export function decodeShareData(payload: string): unknown {
  const json = LZString.decompressFromEncodedURIComponent(payload);
  return json ? JSON.parse(json) : null;
}
