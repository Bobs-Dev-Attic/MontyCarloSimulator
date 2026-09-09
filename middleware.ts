import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: security headers on every response, plus a best-effort
 * rate limiter on the compute endpoints (`/api/*`).
 *
 * Security headers — note on the script policy: these pages are statically
 * prerendered, so the script tags in the cached HTML cannot carry a per-request
 * nonce; a nonce/'strict-dynamic' CSP would refuse Next's own chunks and break
 * hydration. We use `script-src 'self' 'unsafe-inline'`, which still blocks the
 * primary XSS vector (loading scripts from external origins). The app ships no
 * third-party scripts, no `eval`, and no `dangerouslySetInnerHTML`. A stricter
 * nonce CSP is possible but requires dynamic rendering (tracked in TODO.md).
 *
 * Rate limiting — this is an in-memory sliding window per client IP. It runs in
 * the Edge runtime, so the counter is per-isolate and best-effort: it reliably
 * dampens a single client hammering the simulation/export endpoints (DoS / cost
 * amplification), but is not a distributed guarantee. For production-grade
 * limits use Vercel Firewall rules or swap this store for Upstash Redis
 * (`@upstash/ratelimit`). Tunable via env; disable with RATE_LIMIT_DISABLED=1.
 */

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 60;
const MAX_TRACKED_IPS = 5_000; // cap memory

const hits = new Map<string, number[]>();

function takeToken(ip: string): {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
} {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const allowed = recent.length < MAX_REQUESTS;
  if (allowed) recent.push(now);
  hits.set(ip, recent);

  // Bound memory: evict arbitrary old keys if the map grows too large.
  if (hits.size > MAX_TRACKED_IPS) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= MAX_TRACKED_IPS - 1_000) break;
    }
  }

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - recent.length),
    resetSeconds: Math.ceil(WINDOW_MS / 1000),
  };
}

function clientIp(request: NextRequest): string {
  // NextRequest.ip is populated on Vercel; fall back to the forwarded header.
  const fromReq = (request as unknown as { ip?: string }).ip;
  if (fromReq) return fromReq;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function applySecurityHeaders(res: NextResponse): void {
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
  res.headers.set("content-security-policy", csp);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  res.headers.set(
    "strict-transport-security",
    "max-age=63072000; includeSubDomains"
  );
}

export function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const limiterOn = isApi && process.env.RATE_LIMIT_DISABLED !== "1";

  if (limiterOn) {
    const { allowed, remaining, resetSeconds } = takeToken(clientIp(request));
    if (!allowed) {
      const res = new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        { status: 429, headers: { "content-type": "application/json" } }
      );
      applySecurityHeaders(res);
      res.headers.set("retry-after", String(resetSeconds));
      res.headers.set("x-ratelimit-limit", String(MAX_REQUESTS));
      res.headers.set("x-ratelimit-remaining", "0");
      res.headers.set("x-ratelimit-reset", String(resetSeconds));
      return res;
    }
    const res = NextResponse.next();
    applySecurityHeaders(res);
    res.headers.set("x-ratelimit-limit", String(MAX_REQUESTS));
    res.headers.set("x-ratelimit-remaining", String(remaining));
    res.headers.set("x-ratelimit-reset", String(resetSeconds));
    return res;
  }

  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
