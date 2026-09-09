/**
 * Web Worker entry point: runs simulations off the main thread, in the browser.
 *
 * It calls the exact same framework-free orchestration functions as the API
 * routes (`lib/run.ts`), so results are identical to the server path — the only
 * difference is where the CPU work happens. Keeping the API routes as a fallback
 * means nothing breaks if a worker can't start.
 */
import { runGbm, runRetirement } from "../run";
import type { GbmRequest, RetirementRequest } from "../types";

// Minimal typing for the worker global (avoids pulling in the webworker lib,
// which conflicts with the project's DOM lib).
const ctx = self as unknown as {
  postMessage: (message: unknown) => void;
  addEventListener: (type: "message", cb: (e: MessageEvent) => void) => void;
};

export type SimWorkerRequest = {
  id: number;
  kind: "gbm" | "retirement";
  payload: unknown;
};

ctx.addEventListener("message", (e: MessageEvent) => {
  const { id, kind, payload } = e.data as SimWorkerRequest;
  try {
    let result;
    if (kind === "gbm") result = runGbm(payload as GbmRequest);
    else if (kind === "retirement") result = runRetirement(payload as RetirementRequest);
    else throw new Error(`Unknown simulation kind: ${kind}`);
    ctx.postMessage({ id, ok: true, result });
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "Simulation failed",
    });
  }
});
