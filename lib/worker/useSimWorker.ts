"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SimulationResponse } from "@/lib/types";

type Pending = {
  resolve: (r: SimulationResponse) => void;
  reject: (e: Error) => void;
};

/**
 * Runs a GBM / retirement simulation in a Web Worker so the CPU work stays off
 * the main thread (the UI and progress dialog stay responsive). Returns a
 * `run(kind, payload)` promise. If a worker can't be created (old browser, SSR,
 * blocked), `run` rejects with a `worker-unavailable` error so the caller can
 * fall back to the API route.
 */
export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const pending = useRef<Map<number, Pending>>(new Map());

  useEffect(() => {
    const pendingMap = pending.current;
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./simWorker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent) => {
        const { id, ok, result, error } = e.data as {
          id: number;
          ok: boolean;
          result?: SimulationResponse;
          error?: string;
        };
        const p = pending.current.get(id);
        if (!p) return;
        pending.current.delete(id);
        if (ok && result) p.resolve(result);
        else p.reject(new Error(error ?? "Simulation failed"));
      };
      worker.onerror = () => {
        // Reject everything in flight; the caller falls back to the API.
        for (const p of pending.current.values()) p.reject(new Error("worker-error"));
        pending.current.clear();
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => {
      worker?.terminate();
      workerRef.current = null;
      pendingMap.clear();
    };
  }, []);

  const run = useCallback(
    (kind: "gbm" | "retirement", payload: unknown): Promise<SimulationResponse> =>
      new Promise<SimulationResponse>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("worker-unavailable"));
          return;
        }
        const id = nextId.current++;
        pending.current.set(id, { resolve, reject });
        worker.postMessage({ id, kind, payload });
      }),
    []
  );

  return run;
}
