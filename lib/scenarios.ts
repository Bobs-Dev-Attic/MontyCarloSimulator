/**
 * A library of macro / geopolitical shock scenarios for the shock simulator.
 *
 * Each scenario overlays discrete downside jumps on the base GBM regime:
 *   - annualProb:   how often (per year) a shock of this type strikes
 *   - severityMean: the typical instantaneous drawdown when it hits
 *   - volMultiplier + recoveryYears: elevated turbulence while markets recover
 *   - annualDriftDelta: an optional persistent drag on returns (e.g. stagflation)
 *
 * These are illustrative, round-number calibrations for education — not
 * forecasts or fitted parameters.
 */

import type { ShockConfig } from "./gbm";

export interface Scenario {
  id: string;
  name: string;
  blurb: string;
  config: ShockConfig;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "recession",
    name: "Mild recession",
    blurb:
      "A run-of-the-mill downturn: fairly frequent, a moderate drop, a quick recovery.",
    config: {
      annualProb: 0.15,
      severityMean: 0.2,
      severityStd: 0.05,
      volMultiplier: 1.6,
      recoveryYears: 1.5,
    },
  },
  {
    id: "gfc",
    name: "Financial crisis (2008-style)",
    blurb:
      "A rare but severe systemic crash with a deep drawdown and a long, turbulent recovery.",
    config: {
      annualProb: 0.05,
      severityMean: 0.45,
      severityStd: 0.1,
      volMultiplier: 2.2,
      recoveryYears: 3,
    },
  },
  {
    id: "pandemic",
    name: "Pandemic crash (2020-style)",
    blurb:
      "A sudden, sharp shock with a violent drop and a fast but jittery rebound.",
    config: {
      annualProb: 0.04,
      severityMean: 0.34,
      severityStd: 0.08,
      volMultiplier: 2.5,
      recoveryYears: 1,
    },
  },
  {
    id: "geopolitical",
    name: "Geopolitical conflict",
    blurb:
      "War or a major geopolitical rupture: relatively frequent, a sharp risk-off drop, lingering uncertainty.",
    config: {
      annualProb: 0.08,
      severityMean: 0.15,
      severityStd: 0.06,
      volMultiplier: 1.8,
      recoveryYears: 2,
    },
  },
  {
    id: "stagflation",
    name: "Oil shock / stagflation",
    blurb:
      "An energy-price spike with a modest crash and a persistent drag on real returns.",
    config: {
      annualProb: 0.1,
      severityMean: 0.12,
      severityStd: 0.05,
      volMultiplier: 1.5,
      recoveryYears: 2.5,
      annualDriftDelta: -0.03,
    },
  },
  {
    id: "ratehike",
    name: "Rate-hike shock",
    blurb:
      "An aggressive tightening cycle: frequent repricings, a shallower drop, elevated volatility.",
    config: {
      annualProb: 0.12,
      severityMean: 0.1,
      severityStd: 0.04,
      volMultiplier: 1.7,
      recoveryYears: 1.5,
    },
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Dial in your own shock frequency and severity.",
    config: {
      annualProb: 0.1,
      severityMean: 0.25,
      severityStd: 0.07,
      volMultiplier: 1.8,
      recoveryYears: 2,
    },
  },
];

export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
