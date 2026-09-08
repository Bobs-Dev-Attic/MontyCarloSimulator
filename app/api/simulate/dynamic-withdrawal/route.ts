import { NextResponse } from "next/server";
import { runDynamicWithdrawal } from "@/lib/run";
import type { DynamicWithdrawalParams } from "@/lib/dynamicWithdrawal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DynamicWithdrawalParams>;

    const req: Partial<DynamicWithdrawalParams> = {
      startingBalance: num(body.startingBalance, 1_000_000),
      retirementYears: Math.round(num(body.retirementYears, 30)),
      initialRate: num(body.initialRate, 0.05),
      meanReturn: num(body.meanReturn, 0.06),
      stdReturn: num(body.stdReturn, 0.12),
      inflation: num(body.inflation, 0.025),
      guardBand: num(body.guardBand, 0.2),
      guardAdjust: num(body.guardAdjust, 0.1),
      ratchetThreshold: num(body.ratchetThreshold, 0.5),
      ratchetStep: num(body.ratchetStep, 0.1),
      ratchetEvery: Math.round(num(body.ratchetEvery, 3)),
      nSims: Math.round(num(body.nSims, 8000)),
      seed:
        body.seed === null || body.seed === undefined
          ? null
          : Math.round(num(body.seed, 0)),
    };

    if ((req.retirementYears ?? 0) < 1)
      return NextResponse.json({ error: "retirementYears must be at least 1" }, { status: 400 });
    if ((req.stdReturn ?? 0) < 0)
      return NextResponse.json({ error: "stdReturn must be non-negative" }, { status: 400 });
    if ((req.initialRate ?? 0) <= 0)
      return NextResponse.json({ error: "initial withdrawal rate must be positive" }, { status: 400 });

    return NextResponse.json(runDynamicWithdrawal(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
