/**
 * Markov chain health / long-term-care model.
 *
 * Each year a retiree occupies one of four states — Active, Assisted living,
 * Skilled nursing, or Deceased — and transitions between them with annual
 * probabilities that rise with age. Care states add large annual costs on top of
 * base living spending, capturing the sudden late-life step-ups a flat spending
 * assumption misses.
 *
 * The portfolio is simulated twice on the SAME lifespan and market path (common
 * random numbers): once with care costs and once without, so the extra ruin risk
 * attributable to care is isolated. Deceased is an absorbing state, so plan
 * length is endogenous.
 */

import { Rng } from "./rng";

export const STATE = { ACTIVE: 0, ASSISTED: 1, SKILLED: 2, DEAD: 3 } as const;

const MAX_HORIZON = 45; // years simulated (occupancy chart length)

export interface CareParams {
  startAge: number;
  startingBalance: number;
  baseSpend: number; // real living spend per year
  realReturn: number;
  vol: number;
  // Annual transition probabilities at the start age (before the age ramp).
  actToAssisted: number;
  actToSkilled: number;
  actToDead: number;
  asstToSkilled: number;
  asstToDead: number;
  asstToActive: number; // recovery back to independent
  skilledToDead: number;
  ageRamp: number; // per-year growth in decline/death probs after age 70
  // Extra annual cost while in each care state (real $).
  assistedCost: number;
  skilledCost: number;
  nSims: number;
  seed: number | null;
}

export interface CareResult {
  years: number[];
  occupancy: { active: number[]; assisted: number[]; skilled: number[]; dead: number[] };
  probEverCare: number;
  medianYearsInCare: number;
  medianLifetimeCareCost: number;
  p90LifetimeCareCost: number;
  ruinWithCare: number;
  ruinNoCare: number;
  medianDeathAge: number;
  careCostHist: { counts: number[]; edges: number[] };
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

export function simulateCareCosts(params: CareParams): CareResult {
  const {
    startAge,
    startingBalance,
    baseSpend,
    realReturn,
    vol,
    actToAssisted,
    actToSkilled,
    actToDead,
    asstToSkilled,
    asstToDead,
    asstToActive,
    skilledToDead,
    ageRamp,
    assistedCost,
    skilledCost,
    nSims,
    seed,
  } = params;

  const rng = new Rng(seed);

  const occ = {
    active: new Array(MAX_HORIZON).fill(0),
    assisted: new Array(MAX_HORIZON).fill(0),
    skilled: new Array(MAX_HORIZON).fill(0),
    dead: new Array(MAX_HORIZON).fill(0),
  };

  const yearsInCareArr: number[] = [];
  const lifetimeCareArr: number[] = [];
  const deathAges: number[] = [];
  let everCare = 0;
  let ruinWith = 0;
  let ruinNo = 0;

  const careCostOf = (state: number): number =>
    state === STATE.ASSISTED ? assistedCost : state === STATE.SKILLED ? skilledCost : 0;

  for (let s = 0; s < nSims; s++) {
    let state = STATE.ACTIVE as number;
    let age = startAge;
    let balWith = startingBalance;
    let balNo = startingBalance;
    let depWith = false;
    let depNo = false;
    let yearsInCare = 0;
    let lifetimeCare = 0;
    let enteredCare = false;
    let deathYear = MAX_HORIZON;

    for (let t = 0; t < MAX_HORIZON; t++) {
      if (state === STATE.DEAD) {
        occ.dead[t]++;
        continue;
      }
      // Record occupancy for this year's state.
      if (state === STATE.ACTIVE) occ.active[t]++;
      else if (state === STATE.ASSISTED) occ.assisted[t]++;
      else occ.skilled[t]++;

      if (state === STATE.ASSISTED || state === STATE.SKILLED) {
        yearsInCare++;
        enteredCare = true;
      }

      // Portfolio: same return draw for both scenarios (common random numbers).
      const r = rng.normal(realReturn, vol);
      const care = careCostOf(state);
      lifetimeCare += care;

      balWith *= 1 + r;
      balWith -= baseSpend + care;
      if (balWith <= 0 && !depWith) {
        depWith = true;
        balWith = 0;
      }
      balNo *= 1 + r;
      balNo -= baseSpend;
      if (balNo <= 0 && !depNo) {
        depNo = true;
        balNo = 0;
      }

      // Age ramp on decline/death probabilities.
      const ramp = 1 + Math.max(0, age - 70) * ageRamp;
      let next = state;
      const u = rng.next();
      if (state === STATE.ACTIVE) {
        const pDead = Math.min(0.6, actToDead * ramp);
        const pSkil = Math.min(0.3, actToSkilled * ramp);
        const pAsst = Math.min(0.6, actToAssisted * ramp);
        if (u < pDead) next = STATE.DEAD;
        else if (u < pDead + pSkil) next = STATE.SKILLED;
        else if (u < pDead + pSkil + pAsst) next = STATE.ASSISTED;
      } else if (state === STATE.ASSISTED) {
        const pDead = Math.min(0.7, asstToDead * ramp);
        const pSkil = Math.min(0.6, asstToSkilled * ramp);
        const pAct = Math.max(0, asstToActive); // recovery not age-accelerated
        if (u < pDead) next = STATE.DEAD;
        else if (u < pDead + pSkil) next = STATE.SKILLED;
        else if (u < pDead + pSkil + pAct) next = STATE.ACTIVE;
      } else {
        // Skilled nursing — no recovery.
        const pDead = Math.min(0.9, skilledToDead * ramp);
        if (u < pDead) next = STATE.DEAD;
      }

      if (next === STATE.DEAD) {
        deathYear = t + 1;
        state = STATE.DEAD;
      } else {
        state = next;
      }
      age++;
    }

    yearsInCareArr.push(yearsInCare);
    lifetimeCareArr.push(lifetimeCare);
    deathAges.push(startAge + Math.min(deathYear, MAX_HORIZON));
    if (enteredCare) everCare++;
    if (depWith) ruinWith++;
    if (depNo) ruinNo++;
  }

  const years = Array.from({ length: MAX_HORIZON }, (_, i) => i);
  const occupancy = {
    active: occ.active.map((v) => v / nSims),
    assisted: occ.assisted.map((v) => v / nSims),
    skilled: occ.skilled.map((v) => v / nSims),
    dead: occ.dead.map((v) => v / nSims),
  };

  const sortedCare = [...lifetimeCareArr].sort((a, b) => a - b);
  const sortedYears = [...yearsInCareArr].sort((a, b) => a - b);
  const sortedDeath = [...deathAges].sort((a, b) => a - b);

  // Lifetime-care-cost histogram.
  let minC = 0;
  let maxC = sortedCare[sortedCare.length - 1] || 1;
  if (maxC <= 0) maxC = 1;
  const bins = 30;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(minC + ((maxC - minC) * i) / bins);
  const counts = new Array(bins).fill(0);
  for (const v of lifetimeCareArr) {
    let bi = Math.floor(((v - minC) / (maxC - minC)) * bins);
    if (bi < 0) bi = 0;
    if (bi >= bins) bi = bins - 1;
    counts[bi]++;
  }

  return {
    years,
    occupancy,
    probEverCare: everCare / nSims,
    medianYearsInCare: percentile(sortedYears, 50),
    medianLifetimeCareCost: percentile(sortedCare, 50),
    p90LifetimeCareCost: percentile(sortedCare, 90),
    ruinWithCare: ruinWith / nSims,
    ruinNoCare: ruinNo / nSims,
    medianDeathAge: percentile(sortedDeath, 50),
    careCostHist: { counts, edges },
    nSims,
  };
}
