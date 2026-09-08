"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

/**
 * A tiny pub/sub that lets an "Apply to all tabs" control on one input push its
 * value to the matching parameter in every other tab. Each tab registers a
 * handler describing how a shared key maps onto its own state.
 */

export type SharedKey = "beginningValue" | "mu" | "sigma" | "years" | "nSims";

export const SHARED_LABELS: Record<SharedKey, string> = {
  beginningValue: "starting amount",
  mu: "expected return",
  sigma: "volatility",
  years: "time horizon",
  nSims: "simulation count",
};

type Handler = (key: SharedKey, value: number) => void;

interface BroadcastCtx {
  register: (h: Handler) => () => void;
  applyAll: (key: SharedKey, value: number) => void;
}

const Ctx = createContext<BroadcastCtx | null>(null);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef<Set<Handler>>(new Set());
  const register = useCallback((h: Handler) => {
    handlers.current.add(h);
    return () => {
      handlers.current.delete(h);
    };
  }, []);
  const applyAll = useCallback((key: SharedKey, value: number) => {
    // Update every currently-mounted tab live…
    handlers.current.forEach((h) => {
      try {
        h(key, value);
      } catch {
        // ignore a misbehaving handler
      }
    });
    // …and write the value into the other tabs' persisted storage so they pick
    // it up when next opened (only one tab is mounted at a time).
    persistToStorage(key, value);
  }, []);
  return <Ctx.Provider value={{ register, applyAll }}>{children}</Ctx.Provider>;
}

// Scalar-valued persisted keys per shared parameter (written directly).
const SCALAR_TARGETS: Record<SharedKey, string[]> = {
  beginningValue: [
    "mcs.macro.beginningValue",
    "mcs.multi.beginningValue",
    "mcs.glide.beginningValue",
    "mcs.stress.beginningValue",
    "mcs.reverse.beginningValue",
    "mcs.reverse.startingBalance",
  ],
  mu: ["mcs.macro.mu", "mcs.stress.mu", "mcs.reverse.mu", "mcs.reverse.meanReturn", "mcs.glide.riskyMu"],
  sigma: ["mcs.macro.sigma", "mcs.stress.sigma", "mcs.reverse.sigma", "mcs.glide.riskySigma"],
  years: ["mcs.macro.years", "mcs.multi.years", "mcs.glide.years", "mcs.stress.years", "mcs.reverse.years"],
  nSims: ["mcs.macro.nSims", "mcs.multi.nSims", "mcs.glide.nSims", "mcs.stress.nSims"],
};

// Object-valued persisted keys: [storageKey, field]. Merged only if present so
// we never clobber a tab's default object before it has been visited.
const OBJECT_TARGETS: Record<SharedKey, [string, string][]> = {
  beginningValue: [["mcs.sens.gbm", "beginningValue"], ["mcs.sens.ret", "startingBalance"]],
  mu: [["mcs.sens.gbm", "mu"], ["mcs.sens.ret", "meanReturn"]],
  sigma: [["mcs.sens.gbm", "sigma"], ["mcs.sens.ret", "stdReturn"]],
  years: [["mcs.sens.gbm", "years"]],
  nSims: [],
};

function persistToStorage(key: SharedKey, value: number) {
  if (typeof window === "undefined") return;
  try {
    for (const k of SCALAR_TARGETS[key]) localStorage.setItem(k, JSON.stringify(value));
    for (const [k, field] of OBJECT_TARGETS[key]) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw) as Record<string, unknown>;
      obj[field] = value;
      localStorage.setItem(k, JSON.stringify(obj));
    }
  } catch {
    // localStorage unavailable — the live handlers still covered mounted tabs.
  }
}

export function useBroadcast(): BroadcastCtx | null {
  return useContext(Ctx);
}

/** Register a tab's apply handler. The latest closure is always used. */
export function useApplyAllHandler(handler: Handler) {
  const ctx = useContext(Ctx);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!ctx) return;
    return ctx.register((key, value) => ref.current(key, value));
  }, [ctx]);
}
