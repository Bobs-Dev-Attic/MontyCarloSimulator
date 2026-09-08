/**
 * Mortality & longevity model.
 *
 * Replaces a fixed retirement horizon with a stochastic lifespan drawn from a
 * Gompertz mortality law, and (for couples) models the plan lasting until the
 * *second* death (last survivor). This surfaces longevity tail-risk — the real
 * chance a survivor lives past 90, 95, or 100 — and ties it to the portfolio via
 * an "outlive your money" probability.
 *
 * Gompertz force of mortality: μ(x) = (1/b)·exp((x−m)/b), with modal age at
 * death m and dispersion b. Survival from current age a0 to age a:
 *   S(a) = exp[ exp((a0−m)/b) − exp((a−m)/b) ].
 * Sampling a death age given survival quantile u∈(0,1):
 *   T = m + b·ln( exp((a0−m)/b) − ln u ).
 *
 * Default parameters (m male 84 / female 88, b 10) reproduce familiar planning
 * facts — e.g. a 65-year-old couple has roughly a 1-in-5 chance a survivor
 * reaches 95. They are an educational approximation, not a specific actuarial
 * table.
 */

import { Rng } from "./rng";

export type Sex = "male" | "female";

interface Gompertz {
  m: number; // modal age at death
  b: number; // dispersion
}

const PARAMS: Record<Sex, Gompertz> = {
  male: { m: 84, b: 10 },
  female: { m: 88, b: 10 },
};

const MAX_AGE = 115;

/** Survival probability from age a0 to age a under Gompertz(m, b). */
function survival(a0: number, a: number, g: Gompertz): number {
  if (a <= a0) return 1;
  return Math.exp(Math.exp((a0 - g.m) / g.b) - Math.exp((a - g.m) / g.b));
}

/** Sample an age at death given alive at a0. */
function sampleDeathAge(rng: Rng, a0: number, g: Gompertz): number {
  let u = rng.next();
  if (u <= 1e-12) u = 1e-12;
  const t = g.m + g.b * Math.log(Math.exp((a0 - g.m) / g.b) - Math.log(u));
  return Math.min(MAX_AGE, Math.max(a0, t));
}

export interface LongevityParams {
  ageA: number;
  sexA: Sex;
  couple: boolean;
  ageB: number;
  sexB: Sex;
  longevityAdj: number; // years added to modal age (health/longevity tilt)
  startingBalance: number;
  annualSpend: number; // real (today's $) spending per year
  realReturn: number; // real (after-inflation) expected return
  vol: number;
  survivorSpend: number; // spending fraction after the first death (couple)
  nSims: number;
  seed: number | null;
}

export interface LongevityResult {
  couple: boolean;
  ages: number[];
  survivalA: number[];
  survivalB: number[] | null;
  survivalEither: number[] | null;
  medianDeathAgeA: number;
  medianDeathAgeB: number | null;
  medianLastDeathAge: number;
  planMedianYears: number;
  planP10Years: number;
  planP90Years: number;
  tail: { age: number; a: number; b: number | null; either: number | null }[];
  planHist: { counts: number[]; edges: number[] };
  ruinMortality: number; // outlive money (mortality-aware horizon)
  medianTerminalReal: number; // median money left at the last death
  nSims: number;
}

function percentile(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const rank = (q / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - rank) + sorted[hi] * (rank - lo);
}

export function simulateLongevity(params: LongevityParams): LongevityResult {
  const {
    ageA,
    sexA,
    couple,
    ageB,
    sexB,
    longevityAdj,
    startingBalance,
    annualSpend,
    realReturn,
    vol,
    survivorSpend,
    nSims,
    seed,
  } = params;

  const gA: Gompertz = { m: PARAMS[sexA].m + longevityAdj, b: PARAMS[sexA].b };
  const gB: Gompertz = { m: PARAMS[sexB].m + longevityAdj, b: PARAMS[sexB].b };

  // Analytic survival curves for the chart.
  const ages: number[] = [];
  const survivalA: number[] = [];
  const survivalB: number[] = couple ? [] : (null as unknown as number[]);
  const survivalEither: number[] = couple ? [] : (null as unknown as number[]);
  for (let a = Math.min(ageA, couple ? ageB : ageA); a <= 100; a++) {
    ages.push(a);
    const sA = a >= ageA ? survival(ageA, a, gA) : 1;
    survivalA.push(sA);
    if (couple) {
      const sB = a >= ageB ? survival(ageB, a, gB) : 1;
      survivalB.push(sB);
      survivalEither.push(1 - (1 - sA) * (1 - sB));
    }
  }

  const tailAges = [85, 90, 95, 100];
  const tail = tailAges.map((age) => {
    const a = survival(ageA, age, gA);
    const b = couple ? survival(ageB, age, gB) : null;
    const either = couple ? 1 - (1 - a) * (1 - (b as number)) : null;
    return { age, a, b, either };
  });

  // Monte Carlo: sample lifespans and a real decumulation to the last death.
  const rng = new Rng(seed);
  const deathAgesA: number[] = [];
  const deathAgesB: number[] = [];
  const lastDeathAges: number[] = [];
  const planYears: number[] = [];
  const terminals: number[] = [];
  let ruin = 0;

  for (let s = 0; s < nSims; s++) {
    const dA = sampleDeathAge(rng, ageA, gA);
    deathAgesA.push(dA);
    const yearsA = dA - ageA;
    let lastYear = yearsA;
    let firstYear = yearsA;
    let lastAge = dA;
    if (couple) {
      const dB = sampleDeathAge(rng, ageB, gB);
      deathAgesB.push(dB);
      const yearsB = dB - ageB;
      lastYear = Math.max(yearsA, yearsB);
      firstYear = Math.min(yearsA, yearsB);
      lastAge = Math.max(ageA + yearsA, ageB + yearsB);
    }
    const horizon = Math.max(1, Math.round(lastYear));
    lastDeathAges.push(lastAge);
    planYears.push(horizon);

    let balance = startingBalance;
    let depleted = false;
    for (let t = 1; t <= horizon; t++) {
      const r = rng.normal(realReturn, vol);
      balance *= 1 + r;
      const spend = couple && t > firstYear ? annualSpend * survivorSpend : annualSpend;
      balance -= spend;
      if (balance <= 0) {
        balance = 0;
        depleted = true;
        break;
      }
    }
    if (depleted) ruin++;
    terminals.push(balance);
  }

  const sortedA = [...deathAgesA].sort((x, y) => x - y);
  const sortedB = couple ? [...deathAgesB].sort((x, y) => x - y) : null;
  const sortedLast = [...lastDeathAges].sort((x, y) => x - y);
  const sortedPlan = [...planYears].sort((x, y) => x - y);
  const sortedTerm = [...terminals].sort((x, y) => x - y);

  // Plan-length histogram (years).
  let minY = sortedPlan[0];
  let maxY = sortedPlan[sortedPlan.length - 1];
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const bins = 30;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(minY + ((maxY - minY) * i) / bins);
  const counts = new Array(bins).fill(0);
  for (const y of planYears) {
    let bi = Math.floor(((y - minY) / (maxY - minY)) * bins);
    if (bi < 0) bi = 0;
    if (bi >= bins) bi = bins - 1;
    counts[bi]++;
  }

  return {
    couple,
    ages,
    survivalA,
    survivalB: couple ? survivalB : null,
    survivalEither: couple ? survivalEither : null,
    medianDeathAgeA: percentile(sortedA, 50),
    medianDeathAgeB: couple ? percentile(sortedB as number[], 50) : null,
    medianLastDeathAge: percentile(sortedLast, 50),
    planMedianYears: percentile(sortedPlan, 50),
    planP10Years: percentile(sortedPlan, 10),
    planP90Years: percentile(sortedPlan, 90),
    tail,
    planHist: { counts, edges },
    ruinMortality: ruin / nSims,
    medianTerminalReal: percentile(sortedTerm, 50),
    nSims,
  };
}
