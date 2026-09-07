/**
 * Simulation history: a compact, localStorage-backed log of past runs that can
 * be exported (JSON / CSV) or compared against one another.
 *
 * We intentionally store only what's needed to review and compare a run — the
 * inputs, the scalar summary, and the median/percentile *median* trajectory —
 * not the full sample paths or histogram, so a browser's localStorage budget
 * comfortably holds many entries.
 */

import type { SimulationResponse } from "./types";
import type { SummaryStats } from "./aggregate";

const STORAGE_KEY = "mcs.history.v1";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  id: string;
  createdAt: number; // epoch ms
  model: "gbm" | "retirement";
  label: string;
  inputs: Record<string, number | null>;
  summary: SummaryStats;
  /** Median/percentile trajectory kept for overlay comparison. */
  trajectory: { steps: number[]; p5: number[]; p50: number[]; p95: number[] };
  xAxisLabel: string;
  meta: { nSims: number; seed: number | null };
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function labelFor(
  model: "gbm" | "retirement",
  inputs: Record<string, number | null>
): string {
  if (model === "gbm") {
    const bv = inputs.beginningValue ?? 0;
    const mu = ((inputs.mu ?? 0) * 100).toFixed(1);
    const sig = ((inputs.sigma ?? 0) * 100).toFixed(1);
    const yrs = inputs.years ?? 0;
    return `GBM · $${Math.round(bv).toLocaleString()} · μ${mu}% σ${sig}% · ${yrs}y`;
  }
  const sb = inputs.startingBalance ?? 0;
  const wd = inputs.annualWithdrawal ?? 0;
  const acc = inputs.yearsToRetire ?? 0;
  const ret = inputs.retirementYears ?? 0;
  return `Retire · $${Math.round(sb).toLocaleString()} · draw $${Math.round(
    wd
  ).toLocaleString()} · ${acc}+${ret}y`;
}

export function entryFromResult(
  model: "gbm" | "retirement",
  inputs: Record<string, number | null>,
  result: SimulationResponse
): HistoryEntry {
  return {
    id: uid(),
    createdAt: Date.now(),
    model,
    label: labelFor(model, inputs),
    inputs,
    summary: result.summary,
    trajectory: {
      steps: result.bands.steps,
      p5: result.bands.p5,
      p50: result.bands.p50,
      p95: result.bands.p95,
    },
    xAxisLabel: result.xAxis.label,
    meta: {
      nSims: (result.meta.nSims as number) ?? 0,
      seed: (result.meta.seed as number | null) ?? null,
    },
  };
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    // Storage full or unavailable — history is a convenience, so ignore.
  }
}

/** Prepend a new entry (most recent first) and persist. */
export function addEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry
): HistoryEntry[] {
  const next = [entry, ...entries].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return next;
}

export function removeEntry(
  entries: HistoryEntry[],
  id: string
): HistoryEntry[] {
  const next = entries.filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  saveHistory([]);
  return [];
}

// ---- Export helpers --------------------------------------------------------

export function toJson(entries: HistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

const CSV_INPUT_KEYS: Record<"gbm" | "retirement", string[]> = {
  gbm: ["beginningValue", "mu", "sigma", "years", "nSims", "seed"],
  retirement: [
    "startingBalance",
    "annualContribution",
    "yearsToRetire",
    "retirementYears",
    "annualWithdrawal",
    "meanReturn",
    "stdReturn",
    "inflation",
    "nSims",
    "seed",
  ],
};

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flatten every entry into a single CSV (union of columns across models). */
export function toCsv(entries: HistoryEntry[]): string {
  const inputKeys = Array.from(
    new Set([...CSV_INPUT_KEYS.gbm, ...CSV_INPUT_KEYS.retirement])
  );
  const summaryKeys: (keyof SummaryStats)[] = [
    "mean",
    "median",
    "p5",
    "p95",
    "min",
    "max",
    "probLoss",
    "var95",
    "successRate",
  ];
  const header = [
    "id",
    "createdAt",
    "model",
    "label",
    ...inputKeys.map((k) => `in_${k}`),
    ...summaryKeys.map((k) => `out_${k}`),
  ];
  const rows = entries.map((e) => [
    e.id,
    new Date(e.createdAt).toISOString(),
    e.model,
    e.label,
    ...inputKeys.map((k) => e.inputs[k] ?? ""),
    ...summaryKeys.map((k) => e.summary[k]),
  ]);
  return [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");
}

/** Trigger a client-side file download (real browser; not sandboxed). */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain"
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
