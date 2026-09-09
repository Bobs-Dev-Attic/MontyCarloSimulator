import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runMacroShock } from "@/lib/run";
import type { GbmRequest } from "@/lib/types";
import type { ShockConfig } from "@/lib/gbm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GbmRequest> & {
      shock?: Partial<ShockConfig>;
    };

    const req: GbmRequest = {
      beginningValue: num(body.beginningValue, 100_000),
      mu: num(body.mu, 0.07),
      sigma: num(body.sigma, 0.15),
      years: num(body.years, 10),
      stepsPerYear: Math.round(num(body.stepsPerYear, 252)),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed:
        body.seed === null || body.seed === undefined
          ? null
          : Math.round(num(body.seed, 0)),
    };

    const s = body.shock ?? {};
    const shock: ShockConfig = {
      annualProb: Math.min(1, Math.max(0, num(s.annualProb, 0.1))),
      severityMean: Math.min(0.99, Math.max(0, num(s.severityMean, 0.25))),
      severityStd: Math.max(0, num(s.severityStd, 0.07)),
      volMultiplier: Math.max(1, num(s.volMultiplier, 1.8)),
      recoveryYears: Math.max(0, num(s.recoveryYears, 2)),
      annualDriftDelta: num(s.annualDriftDelta, 0),
    };

    if (req.beginningValue <= 0)
      return NextResponse.json(
        { error: "beginningValue must be positive" },
        { status: 400 }
      );
    if (req.years <= 0)
      return NextResponse.json(
        { error: "years must be positive" },
        { status: 400 }
      );

    const result = runMacroShock(req, shock);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
