import { NextResponse } from "next/server";
import { runSequenceRisk } from "@/lib/run";
import type { SequenceRiskParams } from "@/lib/sequenceRisk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SequenceRiskParams>;

    const req: Partial<SequenceRiskParams> = {
      startingBalance: num(body.startingBalance, 1_000_000),
      retirementYears: Math.round(num(body.retirementYears, 30)),
      annualSpend: num(body.annualSpend, 35_000),
      inflation: num(body.inflation, 0.025),
      equityMean: num(body.equityMean, 0.07),
      equityVol: num(body.equityVol, 0.16),
      bufferYield: num(body.bufferYield, 0.03),
      bearYears: Math.round(num(body.bearYears, 3)),
      bearMean: num(body.bearMean, -0.05),
      bearVol: num(body.bearVol, 0.20),
      troughDrawdown: num(body.troughDrawdown, 0.1),
      refillBuffer: body.refillBuffer !== false,
      maxBufferYears: Math.round(num(body.maxBufferYears, 8)),
      targetSellProb: num(body.targetSellProb, 0.05),
      nSims: Math.round(num(body.nSims, 6000)),
      seed:
        body.seed === null || body.seed === undefined
          ? null
          : Math.round(num(body.seed, 0)),
    };

    if ((req.retirementYears ?? 0) < 1)
      return NextResponse.json({ error: "retirementYears must be at least 1" }, { status: 400 });
    if ((req.equityVol ?? 0) < 0 || (req.bearVol ?? 0) < 0)
      return NextResponse.json({ error: "volatility must be non-negative" }, { status: 400 });
    if ((req.annualSpend ?? 0) < 0)
      return NextResponse.json({ error: "annual spending must be non-negative" }, { status: 400 });

    return NextResponse.json(runSequenceRisk(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
