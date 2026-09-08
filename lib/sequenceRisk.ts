/**
 * Sequence-of-returns vulnerability analysis.
 *
 * The first few years of retirement are when a bear market does the most
 * lasting damage: withdrawing into a downturn locks in losses that never
 * recover ("sequence risk"). A common defense is to hold a cash / short-bond
 * buffer (a "bond tent") and spend from it — instead of selling equities — while
 * stocks are in a trough.
 *
 * This model stresses equity returns over the first `bearYears` of retirement,
 * then sweeps the size of that buffer (in years of spending) to quantify:
 *   - the probability of being forced to sell equities while they're in a
 *     trough, and
 *   - the probability of ruin,
 * as a function of buffer size — and reports the smallest buffer that drives the
 * forced-sale probability below a target. All buffer sizes are evaluated on the
 * SAME stressed return paths (common random numbers) so the curve is comparable.
 */

import { Rng } from "./rng";
import { percentile } from "./aggregate";

export interface SequenceRiskParams {
  startingBalance: number;
  retirementYears: number;
  annualSpend: number; // year-1 spending, grown by inflation thereafter
  inflation: number;
  equityMean: number;
  equityVol: number;
  bufferYield: number; // nominal return on the cash/bond buffer (low, deterministic)
  bearYears: number; // length of the stressed early window
  bearMean: number; // stressed equity mean during the window
  bearVol: number; // stressed equity vol during the window
  troughDrawdown: number; // equities are "in a trough" if this far below their peak
  refillBuffer: boolean; // top the buffer back up (sell equities) in healthy years
  maxBufferYears: number; // sweep 0..maxBufferYears
  targetSellProb: number; // acceptable probability of selling equities at a trough
  nSims: number;
  seed: number | null;
}

export interface BufferPoint {
  bufferYears: number;
  bufferDollars: number;
  sellProb: number; // P(forced to sell equities in a trough at least once)
  ruinProb: number;
  medianTerminalReal: number;
}

export interface SequenceRiskResult {
  startingBalance: number;
  retirementYears: number;
  bearYears: number;
  annualSpend: number;
  nSims: number;
  targetSellProb: number;
  refillBuffer: boolean;
  sweep: BufferPoint[];
  /** Both sweeps, so refill on vs off can be compared side by side. */
  compare: { on: BufferPoint[]; off: BufferPoint[] };
  recommendedBufferYears: number | null;
  recommendedBufferDollars: number | null;
  noBuffer: BufferPoint;
  recommended: BufferPoint | null;
  steps: number[]; // year indices for the equity paths
  equityPathNoBuffer: number[]; // median real equity value per year, buffer = 0
  equityPathRecommended: number[]; // median real equity value per year, recommended buffer
}

interface OneBufferResult extends BufferPoint {
  equityMedianByYear?: number[]; // real equity value per year (only when captured)
}

function simulateOneBuffer(
  params: SequenceRiskParams,
  bufferYears: number,
  capture: boolean
): OneBufferResult {
  const {
    startingBalance,
    retirementYears: years,
    annualSpend,
    inflation,
    equityMean,
    equityVol,
    bufferYield,
    bearYears,
    bearMean,
    bearVol,
    troughDrawdown,
    refillBuffer,
    nSims,
    seed,
  } = params;

  // Common random numbers: the same seed for every buffer size, and only equity
  // returns draw from the RNG (the buffer grows deterministically), so each
  // buffer size sees the identical market sequence.
  const rng = new Rng(seed);

  let bufferDollars = bufferYears * annualSpend;
  if (bufferDollars > startingBalance) bufferDollars = startingBalance;
  const equity0 = startingBalance - bufferDollars;

  let sellCount = 0;
  let ruinCount = 0;
  const terminalReal = new Float64Array(nSims);
  const equityByYear: Float64Array[] | null = capture
    ? Array.from({ length: years + 1 }, () => new Float64Array(nSims))
    : null;

  for (let s = 0; s < nSims; s++) {
    let E = equity0;
    let B = bufferDollars;
    // A pure equity price index (compounds returns only) drives trough
    // detection, so it isn't distorted by withdrawals or buffer refills.
    let idx = 1;
    let peakIdx = 1;
    let depleted = false;
    let soldAtTrough = false;
    if (equityByYear) equityByYear[0][s] = E; // real at t=0 (deflator 1)

    for (let t = 1; t <= years; t++) {
      const isBear = t <= bearYears;
      // Always draw so RNG consumption is identical across buffer sizes.
      const rE = rng.normal(isBear ? bearMean : equityMean, isBear ? bearVol : equityVol);

      if (!depleted) {
        E *= 1 + rE;
        B *= 1 + bufferYield;
        idx *= 1 + rE;
        if (idx > peakIdx) peakIdx = idx;
        const deflator = Math.pow(1 + inflation, t);
        let need = annualSpend * Math.pow(1 + inflation, t - 1);
        const inTrough = idx < peakIdx * (1 - troughDrawdown);

        if (inTrough) {
          // Spend from the buffer first to avoid selling equities in the trough.
          const fromB = Math.min(need, B);
          B -= fromB;
          need -= fromB;
          if (need > 1e-6) {
            // Buffer exhausted — forced to sell equities while they're down.
            // Sequence risk is about the vulnerable early years, so only count
            // forced trough sales during the bear window.
            if (t <= bearYears) soldAtTrough = true;
            const fromE = Math.min(need, E);
            E -= fromE;
            need -= fromE;
          }
        } else {
          // Equities are healthy: fund from equities, buffer as backstop.
          const fromE = Math.min(need, E);
          E -= fromE;
          need -= fromE;
          if (need > 1e-6) {
            const fromB = Math.min(need, B);
            B -= fromB;
            need -= fromB;
          }
        }

        if (need > 1e-6) depleted = true; // couldn't fund the withdrawal

        // Rolling bucket: when equities make a new high (idx just set peakIdx),
        // sell some of the gains to top the buffer back up to its target, so
        // it's ready for the next downturn. Refilling only at highs "sells high"
        // and avoids converting equities to cash in ordinary (non-trough) dips.
        const atNewHigh = idx >= peakIdx - 1e-12;
        if (refillBuffer && atNewHigh && !depleted) {
          const target = bufferYears * annualSpend * Math.pow(1 + inflation, t - 1);
          if (B < target) {
            const move = Math.min(target - B, E);
            E -= move;
            B += move;
          }
        }

        if (equityByYear) equityByYear[t][s] = E / deflator;
      } else if (equityByYear) {
        equityByYear[t][s] = 0;
      }
    }

    if (soldAtTrough) sellCount++;
    if (depleted || E + B <= 0) ruinCount++;
    terminalReal[s] = (E + B) / Math.pow(1 + inflation, years);
  }

  const sortedTerminal = Float64Array.from(terminalReal).sort();
  const result: OneBufferResult = {
    bufferYears,
    bufferDollars,
    sellProb: sellCount / nSims,
    ruinProb: ruinCount / nSims,
    medianTerminalReal: percentile(sortedTerminal, 50),
  };
  if (equityByYear) {
    result.equityMedianByYear = equityByYear.map((vals) =>
      percentile(Float64Array.from(vals).sort(), 50)
    );
  }
  return result;
}

export function simulateSequenceRisk(params: SequenceRiskParams): SequenceRiskResult {
  const { retirementYears: years, maxBufferYears, targetSellProb } = params;
  if (years < 1) throw new Error("retirementYears must be at least 1");

  const maxB = Math.max(0, Math.min(20, Math.round(maxBufferYears)));

  const sweepFor = (refill: boolean): BufferPoint[] => {
    const p = { ...params, refillBuffer: refill };
    const out: BufferPoint[] = [];
    for (let b = 0; b <= maxB; b++) {
      const r = simulateOneBuffer(p, b, false);
      out.push({
        bufferYears: r.bufferYears,
        bufferDollars: r.bufferDollars,
        sellProb: r.sellProb,
        ruinProb: r.ruinProb,
        medianTerminalReal: r.medianTerminalReal,
      });
    }
    return out;
  };

  // Compute both variants so the client can show them side by side.
  const sweepOn = sweepFor(true);
  const sweepOff = sweepFor(false);
  const sweep = params.refillBuffer ? sweepOn : sweepOff;

  // Smallest buffer whose forced-sale probability meets the target (the
  // sell-at-trough curve is identical for on/off, so either sweep works).
  const rec = sweep.find((p) => p.sellProb <= targetSellProb) ?? null;

  const steps = Array.from({ length: years + 1 }, (_, i) => i);
  const noBufferFull = simulateOneBuffer(params, 0, true);
  const recFull = rec ? simulateOneBuffer(params, rec.bufferYears, true) : null;

  return {
    startingBalance: params.startingBalance,
    retirementYears: years,
    bearYears: params.bearYears,
    annualSpend: params.annualSpend,
    nSims: params.nSims,
    targetSellProb,
    refillBuffer: params.refillBuffer,
    sweep,
    compare: { on: sweepOn, off: sweepOff },
    recommendedBufferYears: rec ? rec.bufferYears : null,
    recommendedBufferDollars: rec ? rec.bufferDollars : null,
    noBuffer: sweep[0],
    recommended: rec,
    steps,
    equityPathNoBuffer: noBufferFull.equityMedianByYear ?? [],
    equityPathRecommended: recFull?.equityMedianByYear ?? [],
  };
}
