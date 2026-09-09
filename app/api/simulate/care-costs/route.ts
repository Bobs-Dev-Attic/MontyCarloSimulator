import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runCareCosts } from "@/lib/run";
import { CareRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = CareRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.slice(0, 5) },
        { status: 400 }
      );
    }
    return NextResponse.json(runCareCosts(parsed.data));
  } catch (err) {
    return apiError(err);
  }
}
