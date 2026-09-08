"use client";

import { PERSIST_PREFIX } from "./persist";

/**
 * A Profile is a snapshot of every persisted app setting (all localStorage keys
 * under the `mcs.` prefix — inputs for every tab, plus simulation history). It
 * can be exported to a JSON file and imported on another device/browser.
 */

export const PROFILE_FORMAT = "monty-carlo-profile";
export const PROFILE_VERSION = 1;

export interface ProfileFile {
  format: string;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** Gather all persisted settings into a single object. */
export function collectSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PERSIST_PREFIX)) continue;
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

export function buildProfile(): ProfileFile {
  return {
    format: PROFILE_FORMAT,
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectSettings(),
  };
}

export function downloadProfile(name?: string): void {
  const profile = buildProfile();
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

/**
 * Apply an imported profile: replace all persisted settings with its contents.
 * Returns the number of keys written. Callers should reload the page afterwards
 * so every tab re-initializes from the restored values.
 */
export function applyProfile(profile: unknown): number {
  const p = profile as Partial<ProfileFile>;
  if (!p || p.format !== PROFILE_FORMAT || typeof p.data !== "object" || p.data === null) {
    throw new Error("Not a valid Monty Carlo profile file.");
  }
  let count = 0;
  try {
    // Clear existing app keys first so the import is a clean replace.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERSIST_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));

    for (const [k, v] of Object.entries(p.data as Record<string, unknown>)) {
      if (!k.startsWith(PERSIST_PREFIX)) continue;
      localStorage.setItem(k, JSON.stringify(v));
      count++;
    }
  } catch {
    throw new Error("Could not write settings to local storage.");
  }
  return count;
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
