import { runSequenceRisk, runGbm, runRetirement } from "@/lib/run";
import { apiError } from "@/lib/apiError";
import { writeWorkbookWithCharts } from "@/lib/excel/charts";
import {
  buildTaxWorkbook,
  buildSequenceRiskWorkbook,
  buildForecastWorkbook,
  type BuiltWorkbook,
} from "@/lib/excel/workbooks";
import type { TaxParams, Filing } from "@/lib/tax";
import type { SequenceRiskParams } from "@/lib/sequenceRisk";
import type { GbmRequest, RetirementRequest } from "@/lib/types";
import { DEFAULTS } from "@/lib/defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}
const clamp01 = (v: unknown, d: number) => Math.min(1, Math.max(0, num(v, d)));

function taxParams(b: Record<string, unknown>): TaxParams {
  const d = DEFAULTS.tax;
  const filing: Filing =
    b.filing === "mfj" ? "mfj" : b.filing === "single" ? "single" : d.filing;
  return {
    startAge: Math.round(num(b.startAge, d.startAge)),
    filing,
    years: Math.min(50, Math.max(1, Math.round(num(b.years, d.years)))),
    taxable: Math.max(0, num(b.taxable, d.taxable)),
    taxableBasisPct: clamp01(b.taxableBasisPct, d.taxableBasisPct),
    deferred: Math.max(0, num(b.deferred, d.deferred)),
    roth: Math.max(0, num(b.roth, d.roth)),
    annualSpend: Math.max(0, num(b.annualSpend, d.annualSpend)),
    otherIncome: Math.max(0, num(b.otherIncome, d.otherIncome)),
    nominalReturn: num(b.nominalReturn, d.nominalReturn),
    inflation: num(b.inflation, d.inflation),
    ltcgRate: clamp01(b.ltcgRate, d.ltcgRate),
    conversionTopRate: clamp01(b.conversionTopRate, d.conversionTopRate),
    terminalTaxRate: clamp01(b.terminalTaxRate, d.terminalTaxRate),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind ?? "");
    const inputs = (body.inputs as Record<string, unknown>) ?? {};

    let built: BuiltWorkbook;
    if (kind === "tax") {
      built = buildTaxWorkbook(taxParams(inputs));
    } else if (kind === "seqrisk") {
      const result = runSequenceRisk(inputs as Partial<SequenceRiskParams>);
      built = buildSequenceRiskWorkbook(result);
    } else if (kind === "forecast") {
      const model = body.model === "retirement" ? "retirement" : "gbm";
      if (model === "gbm") {
        built = buildForecastWorkbook(runGbm(inputs as unknown as GbmRequest), "Portfolio forecast");
      } else {
        built = buildForecastWorkbook(runRetirement(inputs as unknown as RetirementRequest), "Retirement plan");
      }
    } else {
      return new Response(JSON.stringify({ error: "Unknown export kind" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await writeWorkbookWithCharts(built.workbook, built.charts);
    const body2 = new Uint8Array(buffer);
    return new Response(body2, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Content-Length": String(body2.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
