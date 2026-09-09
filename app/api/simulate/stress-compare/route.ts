import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runStressCompare, type StressCompareRequest } from "@/lib/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StressCompareRequest>;

    const req: StressCompareRequest = {
      beginningValue: num(body.beginningValue, 100_000),
      mu: num(body.mu, 0.07),
      sigma: Math.max(0.001, num(body.sigma, 0.15)),
      years: Math.max(1, Math.round(num(body.years, 20))),
      nSims: Math.round(num(body.nSims, 6000)),
      seed:
        body.seed === null || body.seed === undefined
          ? 2026
          : Math.round(num(body.seed, 2026)),
      scenarioIds: Array.isArray(body.scenarioIds)
        ? body.scenarioIds.map(String)
        : undefined,
    };

    if (req.beginningValue <= 0)
      return NextResponse.json({ error: "beginningValue must be positive" }, { status: 400 });

    return NextResponse.json(runStressCompare(req));
  } catch (err) {
    return apiError(err);
  }
}
