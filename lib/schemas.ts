import { z } from "zod";

/**
 * Request validation for the API routes. These schemas validate/coerce the
 * shape of the request body and reject malformed input with a clean error;
 * range clamping and default-filling remain the job of the `run.ts` wrappers
 * (the compute authority), which draw their default values from `lib/defaults.ts`.
 *
 * Every field is optional (the wrappers supply defaults). Numbers are coerced
 * from strings; null / "" are treated as "absent" so the wrapper's default
 * applies (matching the previous hand-rolled `num()` behavior).
 */

const num = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z.coerce.number().finite().optional()
);
const bool = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z.coerce.boolean().optional()
);
const seed = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.union([z.coerce.number().finite(), z.null()]).optional()
);
const filing = z.enum(["single", "mfj"]).optional();
const sex = z.enum(["male", "female"]).optional();

export const TaxRequestSchema = z
  .object({
    startAge: num,
    filing,
    years: num,
    taxable: num,
    taxableBasisPct: num,
    deferred: num,
    roth: num,
    annualSpend: num,
    otherIncome: num,
    nominalReturn: num,
    inflation: num,
    ltcgRate: num,
    conversionTopRate: num,
    terminalTaxRate: num,
  })
  .strip();

export const CareRequestSchema = z
  .object({
    startAge: num,
    startingBalance: num,
    baseSpend: num,
    realReturn: num,
    vol: num,
    actToAssisted: num,
    actToSkilled: num,
    actToDead: num,
    asstToSkilled: num,
    asstToDead: num,
    asstToActive: num,
    skilledToDead: num,
    ageRamp: num,
    assistedCost: num,
    skilledCost: num,
    nSims: num,
    seed,
  })
  .strip();

export const LongevityRequestSchema = z
  .object({
    ageA: num,
    sexA: sex,
    couple: bool,
    ageB: num,
    sexB: sex,
    longevityAdj: num,
    startingBalance: num,
    annualSpend: num,
    realReturn: num,
    vol: num,
    survivorSpend: num,
    nSims: num,
    seed,
  })
  .strip();

export const SequenceRiskRequestSchema = z
  .object({
    startingBalance: num,
    retirementYears: num,
    annualSpend: num,
    inflation: num,
    equityMean: num,
    equityVol: num,
    bufferYield: num,
    bearYears: num,
    bearMean: num,
    bearVol: num,
    troughDrawdown: num,
    refillBuffer: bool,
    maxBufferYears: num,
    targetSellProb: num,
    nSims: num,
    seed,
  })
  .strip();

export const DynamicWithdrawalRequestSchema = z
  .object({
    startingBalance: num,
    retirementYears: num,
    initialRate: num,
    meanReturn: num,
    stdReturn: num,
    inflation: num,
    guardBand: num,
    guardAdjust: num,
    ratchetThreshold: num,
    ratchetStep: num,
    ratchetEvery: num,
    nSims: num,
    seed,
  })
  .strip();
