import { NextResponse } from "next/server";
import { runCareCosts } from "@/lib/run";
import type { CareParams } from "@/lib/careCosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CareParams>;

    const req: Partial<CareParams> = {
      startAge: Math.round(num(body.startAge, 65)),
      startingBalance: num(body.startingBalance, 1_000_000),
      baseSpend: num(body.baseSpend, 45_000),
      realReturn: num(body.realReturn, 0.035),
      vol: num(body.vol, 0.1),
      actToAssisted: num(body.actToAssisted, 0.03),
      actToSkilled: num(body.actToSkilled, 0.005),
      actToDead: num(body.actToDead, 0.012),
      asstToSkilled: num(body.asstToSkilled, 0.1),
      asstToDead: num(body.asstToDead, 0.08),
      asstToActive: num(body.asstToActive, 0.05),
      skilledToDead: num(body.skilledToDead, 0.25),
      ageRamp: num(body.ageRamp, 0.05),
      assistedCost: num(body.assistedCost, 60_000),
      skilledCost: num(body.skilledCost, 110_000),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed:
        body.seed === null || body.seed === undefined ? null : Math.round(num(body.seed, 0)),
    };

    if ((req.startAge ?? 0) < 30 || (req.startAge ?? 0) > 100)
      return NextResponse.json({ error: "age must be between 30 and 100" }, { status: 400 });
    if ((req.vol ?? 0) < 0)
      return NextResponse.json({ error: "volatility must be non-negative" }, { status: 400 });

    return NextResponse.json(runCareCosts(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
