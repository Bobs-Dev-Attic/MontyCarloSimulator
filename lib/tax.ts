/**
 * Multi-account tax projection: Roth conversions, RMDs, and bracket management
 * across Taxable, Tax-Deferred, and Tax-Free (Roth) buckets.
 *
 * This is a DETERMINISTIC year-by-year projection at an assumed return (Roth
 * conversion analysis is fundamentally about tax mechanics, not market
 * randomness, so a single path keeps the logic auditable). It compares a naive
 * withdrawal plan against a tax-smart plan that fills a target bracket with Roth
 * conversions each year, and reports after-tax terminal wealth, lifetime taxes,
 * RMDs, and conversions.
 *
 * SIMPLIFICATIONS (educational, US-focused, not tax advice):
 *  - 2024 federal ordinary brackets + standard deduction, indexed to inflation.
 *  - Capital gains taxed at a single flat rate on the realized gain fraction.
 *  - No state tax, IRMAA, NIIT, ACA subsidies, or Social Security taxation.
 *  - Taxes are funded from the taxable bucket first; second-order tax on the
 *    tax-funding withdrawal is ignored.
 *  - RMDs use the IRS Uniform Lifetime Table, starting at age 73.
 */

export type Filing = "single" | "mfj";

type Bracket = { upTo: number; rate: number };

const BRACKETS_2024: Record<Filing, Bracket[]> = {
  single: [
    { upTo: 11_600, rate: 0.1 },
    { upTo: 47_150, rate: 0.12 },
    { upTo: 100_525, rate: 0.22 },
    { upTo: 191_950, rate: 0.24 },
    { upTo: 243_725, rate: 0.32 },
    { upTo: 609_350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upTo: 23_200, rate: 0.1 },
    { upTo: 94_300, rate: 0.12 },
    { upTo: 201_050, rate: 0.22 },
    { upTo: 383_900, rate: 0.24 },
    { upTo: 487_450, rate: 0.32 },
    { upTo: 731_200, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

const STD_DEDUCTION_2024: Record<Filing, number> = { single: 14_600, mfj: 29_200 };

// IRS Uniform Lifetime Table divisors (2022+), age → divisor.
const RMD_DIVISOR: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
  105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
};

function rmdDivisor(age: number): number {
  if (age < 73) return 0;
  if (age > 110) return 3.5;
  return RMD_DIVISOR[age] ?? 0;
}

/** Progressive ordinary tax on taxable income (after deduction), scaled brackets. */
function ordinaryTax(taxableIncome: number, brackets: Bracket[]): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (taxableIncome <= prev) break;
    const slice = Math.min(taxableIncome, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return Math.max(0, tax);
}

/** Gross income at the top of the bracket taxed at `rate` (indexed), incl. deduction. */
function bracketTopGross(rate: number, brackets: Bracket[], deduction: number): number {
  for (const b of brackets) {
    if (b.rate === rate) return b.upTo + deduction;
  }
  return Infinity;
}

export interface TaxParams {
  startAge: number;
  filing: Filing;
  years: number;
  taxable: number;
  taxableBasisPct: number; // fraction of taxable that is cost basis (0..1)
  deferred: number;
  roth: number;
  annualSpend: number; // real (today's $) after-tax spending need
  otherIncome: number; // real other taxable ordinary income (e.g. pension), yr 1
  nominalReturn: number;
  inflation: number;
  ltcgRate: number;
  conversionTopRate: number; // fill ordinary income to the top of this bracket (0 disables)
  terminalTaxRate: number; // rate used to value leftover tax-deferred at the end
}

export interface TaxYearRow {
  year: number;
  age: number;
  taxable: number;
  deferred: number;
  roth: number;
  rmd: number;
  conversion: number;
  tax: number;
}

export interface StrategyResult {
  id: "naive" | "smart";
  name: string;
  rows: TaxYearRow[];
  terminalAfterTax: number;
  terminalNominal: number;
  totalTax: number;
  totalRMD: number;
  totalConversions: number;
  depletedYear: number | null;
}

export interface TaxResult {
  years: number;
  naive: StrategyResult;
  smart: StrategyResult;
  afterTaxGain: number; // smart − naive
  taxSaved: number; // naive − smart lifetime tax
}

function runStrategy(
  params: TaxParams,
  useConversions: boolean
): StrategyResult {
  const {
    startAge,
    filing,
    years,
    annualSpend,
    otherIncome,
    nominalReturn,
    inflation,
    ltcgRate,
    conversionTopRate,
    terminalTaxRate,
  } = params;

  let taxable = params.taxable;
  let basis = params.taxable * Math.min(1, Math.max(0, params.taxableBasisPct));
  let deferred = params.deferred;
  let roth = params.roth;

  const baseBrackets = BRACKETS_2024[filing];
  const baseDeduction = STD_DEDUCTION_2024[filing];

  const rows: TaxYearRow[] = [];
  let totalTax = 0;
  let totalRMD = 0;
  let totalConversions = 0;
  let depletedYear: number | null = null;

  for (let t = 0; t < years; t++) {
    const age = startAge + t;
    const infl = Math.pow(1 + inflation, t);
    const brackets = baseBrackets.map((b) => ({ upTo: b.upTo === Infinity ? Infinity : b.upTo * infl, rate: b.rate }));
    const deduction = baseDeduction * infl;
    const spendNeed = annualSpend * infl;
    const otherInc = otherIncome * infl;

    // 1) Growth (taxable gains accrue; basis unchanged).
    taxable *= 1 + nominalReturn;
    deferred *= 1 + nominalReturn;
    roth *= 1 + nominalReturn;

    let ordinaryIncome = otherInc;
    let realizedGain = 0;
    let cash = 0;

    // 2) RMD (ordinary income; provides cash).
    const div = rmdDivisor(age);
    let rmd = 0;
    if (div > 0 && deferred > 0) {
      rmd = deferred / div;
      deferred -= rmd;
      ordinaryIncome += rmd;
      cash += rmd;
      totalRMD += rmd;
    }

    // 3) Roth conversion up to the top of the target bracket.
    let conversion = 0;
    if (useConversions && conversionTopRate > 0 && deferred > 0) {
      const topGross = bracketTopGross(conversionTopRate, brackets, deduction);
      const room = topGross - ordinaryIncome;
      conversion = Math.max(0, Math.min(room, deferred));
      deferred -= conversion;
      roth += conversion;
      ordinaryIncome += conversion;
      totalConversions += conversion;
    }

    // 4) Meet spending: taxable → deferred → roth (RMD cash counts first).
    let need = Math.max(0, spendNeed - cash);
    if (need > 0 && taxable > 0) {
      const take = Math.min(need, taxable);
      const gainFrac = taxable > 0 ? (taxable - basis) / taxable : 0;
      realizedGain += take * gainFrac;
      basis -= take * (1 - gainFrac);
      taxable -= take;
      need -= take;
    }
    if (need > 0 && deferred > 0) {
      const take = Math.min(need, deferred);
      deferred -= take;
      ordinaryIncome += take;
      need -= take;
    }
    if (need > 0 && roth > 0) {
      const take = Math.min(need, roth);
      roth -= take;
      need -= take;
    }
    if (need > 1 && depletedYear === null) depletedYear = t + 1;

    // 5) Taxes (ordinary on income beyond the deduction + LTCG on realized gains).
    const ordTax = ordinaryTax(Math.max(0, ordinaryIncome - deduction), brackets);
    const ltcgTax = Math.max(0, realizedGain) * ltcgRate;
    const tax = ordTax + ltcgTax;
    totalTax += tax;

    // Pay tax: taxable → deferred → roth (second-order tax ignored).
    let taxDue = tax;
    if (taxDue > 0 && taxable > 0) {
      const take = Math.min(taxDue, taxable);
      taxable -= take;
      taxDue -= take;
    }
    if (taxDue > 0 && deferred > 0) {
      const take = Math.min(taxDue, deferred);
      deferred -= take;
      taxDue -= take;
    }
    if (taxDue > 0 && roth > 0) {
      const take = Math.min(taxDue, roth);
      roth -= take;
      taxDue -= take;
    }

    rows.push({
      year: t + 1,
      age,
      taxable: Math.max(0, taxable),
      deferred: Math.max(0, deferred),
      roth: Math.max(0, roth),
      rmd,
      conversion,
      tax,
    });
  }

  const endTaxableGain = Math.max(0, taxable - basis);
  const terminalNominal = taxable + deferred + roth;
  // After-tax value: taxable minus embedded LTCG, deferred discounted by the
  // terminal ordinary rate, Roth at face value.
  const terminalAfterTax =
    taxable - endTaxableGain * ltcgRate + deferred * (1 - terminalTaxRate) + roth;

  return {
    id: useConversions ? "smart" : "naive",
    name: useConversions ? "Tax-smart (Roth conversions)" : "Naive (no conversions)",
    rows,
    terminalAfterTax,
    terminalNominal,
    totalTax,
    totalRMD,
    totalConversions,
    depletedYear,
  };
}

export function simulateTax(params: TaxParams): TaxResult {
  if (params.years < 1) throw new Error("years must be at least 1");
  const naive = runStrategy(params, false);
  const smart = runStrategy(params, true);
  return {
    years: params.years,
    naive,
    smart,
    afterTaxGain: smart.terminalAfterTax - naive.terminalAfterTax,
    taxSaved: naive.totalTax - smart.totalTax,
  };
}
