import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runDynamicWithdrawal } from "@/lib/run";
import { DynamicWithdrawalRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = DynamicWithdrawalRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.slice(0, 5) },
        { status: 400 }
      );
    }
    return NextResponse.json(runDynamicWithdrawal(parsed.data));
  } catch (err) {
    return apiError(err);
  }
}
