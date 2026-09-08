import { NextResponse } from "next/server";
import { runTax } from "@/lib/run";
import type { TaxParams } from "@/lib/tax";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<TaxParams>;

    const req: Partial<TaxParams> = {
      startAge: Math.round(num(body.startAge, 62)),
      filing: body.filing === "mfj" ? "mfj" : "single",
      years: Math.round(num(body.years, 30)),
      taxable: num(body.taxable, 0),
      taxableBasisPct: num(body.taxableBasisPct, 0.6),
      deferred: num(body.deferred, 1_200_000),
      roth: num(body.roth, 150_000),
      annualSpend: num(body.annualSpend, 60_000),
      otherIncome: num(body.otherIncome, 30_000),
      nominalReturn: num(body.nominalReturn, 0.06),
      inflation: num(body.inflation, 0.025),
      ltcgRate: num(body.ltcgRate, 0.15),
      conversionTopRate: num(body.conversionTopRate, 0.12),
      terminalTaxRate: num(body.terminalTaxRate, 0.24),
    };

    if ((req.startAge ?? 0) < 40 || (req.startAge ?? 0) > 90)
      return NextResponse.json({ error: "age must be between 40 and 90" }, { status: 400 });
    if ((req.years ?? 0) < 1 || (req.years ?? 0) > 50)
      return NextResponse.json({ error: "years must be between 1 and 50" }, { status: 400 });

    return NextResponse.json(runTax(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
