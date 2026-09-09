import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers, including a Content-Security-Policy.
 *
 * Note on the script policy: these pages are statically prerendered, so the
 * script tags in the cached HTML cannot carry a per-request nonce — a
 * nonce/'strict-dynamic' CSP would refuse Next's own chunks and break
 * hydration. We therefore use `script-src 'self' 'unsafe-inline'`, which still
 * blocks the primary XSS vector (loading scripts from external origins) while
 * allowing Next's same-origin chunks and inline bootstrap. The app ships no
 * third-party scripts, no `eval`, and no `dangerouslySetInnerHTML`, so the
 * residual risk of allowing inline scripts is low. A stricter nonce-based CSP
 * is possible but requires switching the app to dynamic rendering (tracked in
 * TODO.md).
 */
export function middleware(request: NextRequest) {
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

  const response = NextResponse.next();
  response.headers.set("content-security-policy", csp);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  response.headers.set(
    "strict-transport-security",
    "max-age=63072000; includeSubDomains"
  );
  return response;
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
