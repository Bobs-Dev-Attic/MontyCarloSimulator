import { NextResponse } from "next/server";
import { runGbm } from "@/lib/run";
import type { GbmRequest } from "@/lib/types";

// Node runtime: the simulation is CPU-bound number crunching.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GbmRequest>;

    const req: GbmRequest = {
      beginningValue: num(body.beginningValue, 10_000),
      mu: num(body.mu, 0.07),
      sigma: num(body.sigma, 0.15),
      years: num(body.years, 10),
      stepsPerYear: Math.round(num(body.stepsPerYear, 252)),
      nSims: Math.round(num(body.nSims, 10_000)),
      contributionPerStep: num(body.contributionPerStep, 0),
      seed:
        body.seed === null || body.seed === undefined
          ? null
          : Math.round(num(body.seed, 0)),
      dist:
        body.dist?.kind === "t"
          ? { kind: "t", nu: Math.max(2.1, num(body.dist?.nu, 5)) }
          : { kind: "normal" },
    };

    if (req.beginningValue <= 0)
      return NextResponse.json(
        { error: "beginningValue must be positive" },
        { status: 400 }
      );
    if (req.sigma < 0)
      return NextResponse.json(
        { error: "sigma must be non-negative" },
        { status: 400 }
      );
    if (req.years <= 0)
      return NextResponse.json(
        { error: "years must be positive" },
        { status: 400 }
      );

    const result = runGbm(req);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
