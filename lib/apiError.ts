import { NextResponse } from "next/server";

/**
 * Turn an unexpected error into a client response without leaking internals.
 * The real error is logged server-side; the client gets a generic message.
 * (Deliberate, user-facing validation messages — e.g. zod 400s or explicit
 * range checks — should be returned directly, not routed through here.)
 */
export function apiError(err: unknown, status = 400): NextResponse {
  console.error("[api] request failed:", err);
  return NextResponse.json(
    { error: "Request could not be processed. Please check your inputs and try again." },
    { status }
  );
}
