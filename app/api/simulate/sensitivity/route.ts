import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import {
  runTornado,
  type SensModel,
  type Metric,
  type GbmInputs,
  type RetirementInputs,
} from "@/lib/sensitivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      model?: SensModel;
      metric?: Metric;
      variationPct?: number;
      nSims?: number;
      inputs?: Record<string, number>;
    };

    const model: SensModel = body.model === "retirement" ? "retirement" : "gbm";
    const i = body.inputs ?? {};
    const variationPct = Math.min(0.9, Math.max(0.01, num(body.variationPct, 0.2)));
    const nSims = Math.min(20_000, Math.max(500, Math.round(num(body.nSims, 4000))));

    let metric: Metric = (body.metric as Metric) ?? (model === "gbm" ? "median" : "successRate");
    const validGbm: Metric[] = ["median", "p5", "probLoss"];
    const validRet: Metric[] = ["successRate", "median", "p5"];
    if (model === "gbm" && !validGbm.includes(metric)) metric = "median";
    if (model === "retirement" && !validRet.includes(metric)) metric = "successRate";

    let result;
    if (model === "gbm") {
      const inputs: GbmInputs = {
        beginningValue: num(i.beginningValue, 100_000),
        mu: num(i.mu, 0.07),
        sigma: num(i.sigma, 0.15),
        years: Math.max(1, Math.round(num(i.years, 10))),
      };
      if (inputs.beginningValue <= 0)
        return NextResponse.json({ error: "beginningValue must be positive" }, { status: 400 });
      result = runTornado(model, inputs, metric, variationPct, nSims);
    } else {
      const inputs: RetirementInputs = {
        startingBalance: num(i.startingBalance, 100_000),
        annualContribution: num(i.annualContribution, 15_000),
        yearsToRetire: Math.max(0, Math.round(num(i.yearsToRetire, 25))),
        retirementYears: Math.max(1, Math.round(num(i.retirementYears, 30))),
        annualWithdrawal: num(i.annualWithdrawal, 60_000),
        meanReturn: num(i.meanReturn, 0.06),
        stdReturn: num(i.stdReturn, 0.12),
        inflation: num(i.inflation, 0.025),
      };
      result = runTornado(model, inputs, metric, variationPct, nSims);
    }

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
