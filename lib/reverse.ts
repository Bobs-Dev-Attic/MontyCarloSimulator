/**
 * Deterministic reverse stress testing.
 *
 * Forward Monte Carlo asks: "given my assumptions, what outcomes are possible?"
 * Reverse stress testing flips it: "what scenario would *cause* a defined
 * failure — and, under my assumptions, how plausible is that scenario?"
 *
 * Everything here is deterministic: closed-form solutions where they exist and
 * monotonic bisection root-finding otherwise. No random sampling, so the same
 * inputs always give the same answer.
 */

/** Standard normal CDF via an erf approximation (A&S 7.1.26, |err| < 1.5e-7). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Bisection root finder for a monotonic f on [lo, hi]. Returns null if no sign change. */
function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  iterations = 200
): number | null {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (Number.isNaN(fa) || Number.isNaN(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null; // no sign change in the bracket
  for (let i = 0; i < iterations; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < 1e-10) return m;
    if (fa * fm < 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

// ---------------------------------------------------------------------------
// Portfolio (GBM) reverse stress
// ---------------------------------------------------------------------------

export interface GbmReverseInput {
  beginningValue: number;
  years: number;
  mu: number; // assumed expected annual return
  sigma: number; // assumed annual volatility
  lossFraction: number; // the failure: a drawdown of this fraction (0..1)
}

export interface GbmReverseOutput {
  targetValue: number; // portfolio value at the failure point
  requiredTotalReturn: number; // cumulative return to reach failure (= -lossFraction)
  requiredCagr: number; // constant annual return that produces the failure
  zScore: number; // how many std devs below the assumed mean (log space)
  probability: number; // P(terminal <= target) under the assumed lognormal
  oneInN: number; // 1 / probability, the "1-in-N" framing
}

export function gbmReverseStress(inp: GbmReverseInput): GbmReverseOutput {
  const ratio = 1 - inp.lossFraction; // target / beginningValue
  const targetValue = inp.beginningValue * ratio;
  const requiredTotalReturn = ratio - 1; // = -lossFraction
  const requiredCagr = Math.pow(ratio, 1 / inp.years) - 1;

  // Under GBM, ln(S_T / S_0) ~ Normal((mu - 0.5*sigma^2)*T, sigma^2 * T).
  const requiredLog = Math.log(ratio);
  const meanLog = (inp.mu - 0.5 * inp.sigma * inp.sigma) * inp.years;
  const sd = inp.sigma * Math.sqrt(inp.years);
  const zScore =
    sd > 0 ? (requiredLog - meanLog) / sd : requiredLog <= meanLog ? -Infinity : Infinity;
  const probability = normalCdf(zScore);
  const oneInN = probability > 0 ? 1 / probability : Infinity;

  return {
    targetValue,
    requiredTotalReturn,
    requiredCagr,
    zScore,
    probability,
    oneInN,
  };
}

// ---------------------------------------------------------------------------
// Retirement reverse stress
// ---------------------------------------------------------------------------

export interface RetirementReverseInput {
  startingBalance: number;
  annualContribution: number;
  yearsToRetire: number;
  retirementYears: number;
  annualWithdrawal: number; // first-year withdrawal (grown by inflation)
  inflation: number;
  meanReturn: number; // assumed constant annual return
}

/**
 * Deterministic year-by-year end balance (NOT floored at zero, so we can find
 * the exact crossing point), for a constant annual return `r`, first-year
 * withdrawal `w`, and an optional one-time market shock applied at the start of
 * retirement (a fractional drop, 0..1).
 */
function deterministicEndBalance(
  inp: RetirementReverseInput,
  r: number,
  w: number,
  retirementShock = 0
): { end: number; depletionRetirementYear: number | null } {
  const total = inp.yearsToRetire + inp.retirementYears;
  let bal = inp.startingBalance;
  let depletion: number | null = null;

  for (let t = 1; t <= total; t++) {
    bal = bal * (1 + r);
    if (t <= inp.yearsToRetire) {
      bal += inp.annualContribution;
    } else {
      if (t === inp.yearsToRetire + 1 && retirementShock > 0) {
        bal *= 1 - retirementShock;
      }
      const wy = t - inp.yearsToRetire - 1;
      bal -= w * Math.pow(1 + inp.inflation, wy);
    }
    if (bal <= 0 && depletion === null) {
      depletion = t - inp.yearsToRetire; // year into retirement (may be <=0 if during accumulation)
    }
  }
  return { end: bal, depletionRetirementYear: depletion };
}

export interface RetirementReverseOutput {
  survivesAtAssumption: boolean; // does the plan end >= 0 at the assumed return?
  endBalanceAtAssumption: number;
  requiredReturn: number | null; // constant return needed to end at exactly $0
  maxWithdrawal: number | null; // max sustainable first-year withdrawal at the assumed return
  depletionRetirementYear: number | null; // year into retirement the money runs out (null = survives)
  maxRetirementShock: number | null; // largest one-time crash at retirement the plan absorbs
  assumedReturn: number;
  currentWithdrawal: number;
}

export function retirementReverseStress(
  inp: RetirementReverseInput
): RetirementReverseOutput {
  const base = deterministicEndBalance(inp, inp.meanReturn, inp.annualWithdrawal, 0);
  const survives = base.end >= 0;

  // Required constant return to end at exactly $0 (end balance increases with r).
  const requiredReturn = bisect(
    (r) => deterministicEndBalance(inp, r, inp.annualWithdrawal, 0).end,
    -0.9,
    2.0
  );

  // Max sustainable first-year withdrawal at the assumed return (end decreases with w).
  const maxWithdrawal = bisect(
    (w) => deterministicEndBalance(inp, inp.meanReturn, w, 0).end,
    0,
    Math.max(inp.startingBalance, 1) * 50 + 1_000_000
  );

  // Largest one-time crash at retirement start the plan can absorb (end decreases with shock).
  let maxRetirementShock: number | null = null;
  if (survives) {
    maxRetirementShock = bisect(
      (s) => deterministicEndBalance(inp, inp.meanReturn, inp.annualWithdrawal, s).end,
      0,
      1
    );
    // If it still survives a total wipeout at retirement, cap at 1 (100%).
    if (maxRetirementShock === null) maxRetirementShock = 1;
  } else {
    maxRetirementShock = 0;
  }

  return {
    survivesAtAssumption: survives,
    endBalanceAtAssumption: base.end,
    requiredReturn,
    maxWithdrawal: maxWithdrawal !== null ? Math.max(0, maxWithdrawal) : null,
    depletionRetirementYear:
      base.depletionRetirementYear !== null && base.depletionRetirementYear > 0
        ? base.depletionRetirementYear
        : base.depletionRetirementYear !== null
        ? 0
        : null,
    maxRetirementShock,
    assumedReturn: inp.meanReturn,
    currentWithdrawal: inp.annualWithdrawal,
  };
}
