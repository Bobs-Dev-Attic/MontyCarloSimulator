"use client";

/**
 * Simulations run as a single request/response (the serverless route computes
 * everything and returns), so there is no incremental progress to report. To
 * still show a meaningful progress bar and ETA, we estimate how long a run will
 * take from how long past runs of the same model took, scaled by the amount of
 * work (≈ number of simulations × number of steps/years).
 *
 * A rolling rate (milliseconds per unit of work) is kept per model and updated
 * after every run, so the estimate self-calibrates to the user's device. Stored
 * OUTSIDE the `mcs.` profile namespace so it isn't exported/imported/reset as a
 * user setting — it's just a local performance cache.
 */

const KEY = "mcRates.v1";

/** Seed rate (ms per work-unit) before any run has been observed. */
const DEFAULT_RATE = 0.014;
const MIN_MS = 350;
const MAX_MS = 60_000;

type Rates = Record<string, number>;

function load(): Rates {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Rates;
  } catch {
    // ignore
  }
  return {};
}

function save(r: Rates): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

/** Estimated duration, in ms, for `work` units of the given model. */
export function estimateMs(model: string, work: number): number {
  const rate = load()[model] ?? DEFAULT_RATE;
  const w = Number.isFinite(work) && work > 0 ? work : 10_000;
  return Math.min(MAX_MS, Math.max(MIN_MS, rate * w));
}

/** Fold an observed run duration back into the model's rolling rate estimate. */
export function recordRun(model: string, work: number, ms: number): void {
  if (!Number.isFinite(work) || work <= 0 || !Number.isFinite(ms) || ms <= 0) return;
  const rates = load();
  const observed = ms / work;
  const prev = rates[model];
  // Exponential moving average so the estimate adapts but doesn't whipsaw.
  rates[model] = prev == null ? observed : prev * 0.5 + observed * 0.5;
  save(rates);
}
