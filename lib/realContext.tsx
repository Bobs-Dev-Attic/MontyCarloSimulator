"use client";

import { createContext, useContext } from "react";
import type { SimulationResponse } from "./types";
import { deflateResponse } from "./real";
import { usePersistentState } from "./persist";

interface RealContextValue {
  real: boolean;
  inflation: number;
  setReal: (v: boolean) => void;
  setInflation: (v: number) => void;
  /** Convert a nominal response to real terms when the toggle is on. */
  adjust: (resp: SimulationResponse) => SimulationResponse;
}

const RealContext = createContext<RealContextValue | null>(null);

export function RealProvider({ children }: { children: React.ReactNode }) {
  const [real, setReal] = usePersistentState("real.enabled", false);
  const [inflation, setInflation] = usePersistentState("real.inflation", 0.03);

  const adjust = (resp: SimulationResponse) =>
    real ? deflateResponse(resp, inflation) : resp;

  return (
    <RealContext.Provider value={{ real, inflation, setReal, setInflation, adjust }}>
      {children}
    </RealContext.Provider>
  );
}

export function useReal(): RealContextValue {
  const ctx = useContext(RealContext);
  if (!ctx) {
    // Fallback (should not happen): no-op adjuster.
    return {
      real: false,
      inflation: 0,
      setReal: () => {},
      setInflation: () => {},
      adjust: (r) => r,
    };
  }
  return ctx;
}
