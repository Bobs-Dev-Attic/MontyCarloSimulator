import { NextResponse } from "next/server";
import { runLongevity } from "@/lib/run";
import type { LongevityParams } from "@/lib/mortality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LongevityParams>;

    const req: Partial<LongevityParams> = {
      ageA: Math.round(num(body.ageA, 65)),
      sexA: body.sexA === "female" ? "female" : "male",
      couple: Boolean(body.couple),
      ageB: Math.round(num(body.ageB, 63)),
      sexB: body.sexB === "male" ? "male" : "female",
      longevityAdj: num(body.longevityAdj, 0),
      startingBalance: num(body.startingBalance, 1_000_000),
      annualSpend: num(body.annualSpend, 45_000),
      realReturn: num(body.realReturn, 0.035),
      vol: num(body.vol, 0.1),
      survivorSpend: num(body.survivorSpend, 0.75),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed:
        body.seed === null || body.seed === undefined ? null : Math.round(num(body.seed, 0)),
    };

    if ((req.ageA ?? 0) < 30 || (req.ageA ?? 0) > 100)
      return NextResponse.json({ error: "age must be between 30 and 100" }, { status: 400 });
    if ((req.vol ?? 0) < 0)
      return NextResponse.json({ error: "volatility must be non-negative" }, { status: 400 });

    return NextResponse.json(runLongevity(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
