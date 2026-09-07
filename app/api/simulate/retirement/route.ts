import { NextResponse } from "next/server";
import { runRetirement } from "@/lib/run";
import type { RetirementRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RetirementRequest>;

    const req: RetirementRequest = {
      startingBalance: num(body.startingBalance, 100_000),
      annualContribution: num(body.annualContribution, 15_000),
      yearsToRetire: Math.round(num(body.yearsToRetire, 25)),
      retirementYears: Math.round(num(body.retirementYears, 30)),
      annualWithdrawal: num(body.annualWithdrawal, 60_000),
      meanReturn: num(body.meanReturn, 0.06),
      stdReturn: num(body.stdReturn, 0.12),
      inflation: num(body.inflation, 0.025),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed:
        body.seed === null || body.seed === undefined
          ? null
          : Math.round(num(body.seed, 0)),
    };

    if (req.yearsToRetire < 0 || req.retirementYears < 0)
      return NextResponse.json(
        { error: "year counts must be non-negative" },
        { status: 400 }
      );
    if (req.stdReturn < 0)
      return NextResponse.json(
        { error: "stdReturn must be non-negative" },
        { status: 400 }
      );
    if (req.yearsToRetire + req.retirementYears < 1)
      return NextResponse.json(
        { error: "total horizon must be at least 1 year" },
        { status: 400 }
      );

    const result = runRetirement(req);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
