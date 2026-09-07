import type { PercentileBands, Histogram, SummaryStats } from "./aggregate";

export interface SamplePath {
  steps: number[];
  values: number[];
}

/** Compact, JSON-serializable result returned by the API to the browser. */
export interface SimulationResponse {
  model: "gbm" | "retirement";
  bands: PercentileBands;
  histogram: Histogram;
  summary: SummaryStats;
  /** A handful of full example trajectories for display. */
  samplePaths: SamplePath[];
  /** X-axis meta so the client can label steps as years. */
  xAxis: {
    label: string;
    /** Converts a step index into its x value (e.g. years). */
    unitPerStep: number;
    unit: string;
  };
  meta: {
    nSims: number;
    seed: number | null;
    /** Extra model-specific facts (e.g. retirement success rate, phase split). */
    [key: string]: unknown;
  };
}

export interface GbmRequest {
  beginningValue: number;
  mu: number;
  sigma: number;
  years: number;
  stepsPerYear?: number;
  nSims?: number;
  contributionPerStep?: number;
  seed?: number | null;
}

export interface RetirementRequest {
  startingBalance: number;
  annualContribution: number;
  yearsToRetire: number;
  retirementYears: number;
  annualWithdrawal: number;
  meanReturn: number;
  stdReturn: number;
  inflation?: number;
  nSims?: number;
  seed?: number | null;
}
