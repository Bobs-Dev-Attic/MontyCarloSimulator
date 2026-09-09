import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runGlidePath, type GlidePathRequest } from "@/lib/run";
import type { Waypoint } from "@/lib/glidepath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GlidePathRequest>;

    const years = Math.max(1, Math.round(num(body.years, 30)));
    const rawWps = Array.isArray(body.waypoints) ? body.waypoints : [];
    let waypoints: Waypoint[] = rawWps
      .map((w) => ({
        year: Math.min(years, Math.max(0, num((w as Waypoint).year, 0))),
        alloc: Math.min(1, Math.max(0, num((w as Waypoint).alloc, 0.6))),
      }))
      .sort((a, b) => a.year - b.year);
    if (waypoints.length === 0) {
      waypoints = [
        { year: 0, alloc: 0.9 },
        { year: years, alloc: 0.3 },
      ];
    }

    const req: GlidePathRequest = {
      riskyMu: num(body.riskyMu, 0.08),
      riskySigma: Math.max(0.001, num(body.riskySigma, 0.17)),
      safeMu: num(body.safeMu, 0.03),
      safeSigma: Math.max(0, num(body.safeSigma, 0.05)),
      rho: Math.min(1, Math.max(-1, num(body.rho, 0.1))),
      waypoints,
      beginningValue: num(body.beginningValue, 100_000),
      years,
      annualContribution: Math.max(0, num(body.annualContribution, 0)),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed: body.seed === null || body.seed === undefined ? null : Math.round(num(body.seed, 0)),
    };

    if (req.beginningValue <= 0)
      return NextResponse.json({ error: "beginningValue must be positive" }, { status: 400 });

    return NextResponse.json(runGlidePath(req));
  } catch (err) {
    return apiError(err);
  }
}
