"use client";

import { PERSIST_PREFIX } from "./persist";

/**
 * Settings are grouped into user-facing categories so the export / import
 * dialogs can let people choose exactly what to move. Each category matches a
 * set of persisted keys (by their name after the `mcs.` prefix is stripped).
 */
export interface ProfileCategory {
  id: string;
  label: string;
  hint?: string;
  match: (bareKey: string) => boolean;
}

function strip(key: string): string {
  return key.startsWith(PERSIST_PREFIX) ? key.slice(PERSIST_PREFIX.length) : key;
}

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  { id: "theme", label: "Preferences & theme", hint: "Color theme, parameter ranges & defaults", match: (k) => k === "prefs.v1" },
  { id: "portfolio", label: "Portfolio forecast", hint: "GBM inputs", match: (k) => k === "gbm.settings" },
  { id: "retirement", label: "Retirement plan", hint: "Accumulation & withdrawal inputs", match: (k) => k === "ret.settings" },
  { id: "dynwithdraw", label: "Dynamic withdrawals", match: (k) => k.startsWith("dyn.") },
  { id: "reverse", label: "Reverse stress test", match: (k) => k.startsWith("reverse.") },
  { id: "macro", label: "Macro shock", match: (k) => k.startsWith("macro.") },
  { id: "sensitivity", label: "Sensitivity", match: (k) => k.startsWith("sens.") },
  { id: "multiasset", label: "Multi-asset", match: (k) => k.startsWith("multi.") },
  { id: "glide", label: "Risk glide path", match: (k) => k.startsWith("glide.") },
  { id: "stress", label: "Stress compare", match: (k) => k.startsWith("stress.") },
  { id: "display", label: "Display options", hint: "Real / inflation-adjusted toggle", match: (k) => k.startsWith("real.") },
  { id: "ui", label: "Active view", hint: "Which view/model is open", match: (k) => k.startsWith("ui.") },
  { id: "history", label: "Simulation history", hint: "Saved past runs", match: (k) => k.startsWith("history.") },
];

export const OTHER_CATEGORY: ProfileCategory = {
  id: "other",
  label: "Other settings",
  hint: "Anything not recognized above",
  match: () => true,
};

/** Which category a persisted key belongs to. */
export function categoryForKey(fullKey: string): string {
  const bare = strip(fullKey);
  for (const c of PROFILE_CATEGORIES) if (c.match(bare)) return c.id;
  return OTHER_CATEGORY.id;
}

export interface CategorySummary {
  id: string;
  label: string;
  hint?: string;
  keyCount: number;
  /** Extra human detail, e.g. the number of history runs. */
  detail?: string;
}

/** Summarize a settings map into the categories it contains, in display order. */
export function summarizeData(data: Record<string, unknown>): CategorySummary[] {
  const counts: Record<string, number> = {};
  for (const k of Object.keys(data)) {
    const id = categoryForKey(k);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const out: CategorySummary[] = [];
  for (const c of [...PROFILE_CATEGORIES, OTHER_CATEGORY]) {
    const n = counts[c.id] ?? 0;
    if (n === 0) continue;
    let detail: string | undefined;
    if (c.id === "history") {
      const h = data[PERSIST_PREFIX + "history.v1"];
      if (Array.isArray(h)) detail = `${h.length} run${h.length === 1 ? "" : "s"}`;
    }
    out.push({ id: c.id, label: c.label, hint: c.hint, keyCount: n, detail });
  }
  return out;
}
