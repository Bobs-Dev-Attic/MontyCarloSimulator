import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runTax } from "@/lib/run";
import { TaxRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = TaxRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.slice(0, 5) },
        { status: 400 }
      );
    }
    return NextResponse.json(runTax(parsed.data));
  } catch (err) {
    return apiError(err);
  }
}
