# TODO

Prioritized backlog from the review in [docs/REVIEW.md](docs/REVIEW.md). Ordered
so that quick, high-value hardening comes before larger investments. Each item
notes rough effort (S/M/L), the driving perspective, and the review section.

Legend: **P0** critical · **P1** high · **P2** medium · **P3** nice-to-have.

There are **no P0 items** — nothing is broken or actively exploitable; the finance
math is validated. The list is about hardening and future-proofing.

---

## P1 — do first

- [x] **Add security headers** (S · security) — _done v1.32.0._ CSP +
  `X-Frame-Options: DENY` + `frame-ancestors 'none'` + `X-Content-Type-Options`
  + `Referrer-Policy` + `Strict-Transport-Security` + `Permissions-Policy`, via
  `middleware.ts`. Note: the script policy is `'self' 'unsafe-inline'` (blocks
  external scripts — the real XSS vector) rather than nonce/strict-dynamic,
  because these pages are statically prerendered and a nonce CSP would refuse
  Next's own chunks. A stricter nonce CSP is a follow-up (see P2). _REVIEW §2.2._
- [x] **Add legal/baseline docs** (S · legal/founder) — _done v1.32.0._ `LICENSE`
  (MIT, holder `Bobs-Dev-Attic` — change if you want a different license/holder),
  `PRIVACY.md`, `SECURITY.md` (GitHub private vulnerability reporting, no personal
  email). _REVIEW §6.1._
- [x] **State the privacy posture in-app + PRIVACY.md** (S · legal/marketing) —
  _done v1.32.0._ Footer line ("Runs entirely in your browser — no account, no
  tracking…") linking to `PRIVACY.md`. _REVIEW §6.2._
- [x] **Rate-limit the compute endpoints** (M · security/founder) — _done
  v1.33.0._ In-memory sliding-window limiter in `middleware.ts` on `/api/*`
  (default 60 req/min per IP; env-tunable via `RATE_LIMIT_MAX` /
  `RATE_LIMIT_WINDOW_MS`; returns 429 + `Retry-After`/`X-RateLimit-*`). Verified:
  the 61st request in a window gets 429. Note: per-isolate/best-effort on Edge —
  for a distributed guarantee, add Vercel Firewall rules or swap the store for
  Upstash Redis (extension point documented in the middleware). _REVIEW §2.1._
- [x] **Cover the export route in `vercel.json`** (S · ops) — _done v1.32.0._
  Added `app/api/export/**` at 1024 MB / 30 s. _REVIEW §2.1._
- [x] **Add a test suite** (M · engineering) — _done v1.33.0._ **Vitest** (28
  tests, `test/*.test.ts`) covering rng (determinism + distribution), aggregate
  (percentile ordering, histogram sums), gbm/retirement (determinism, bounds,
  monotonic success), tax (identities, non-negative buckets, RMD timing,
  conversions, `taxable=0`, a locked regression value), and sequence-risk /
  longevity / care-costs invariants. `npm test` runs `vitest run`; CI executes
  it. _REVIEW §1.1._
- [x] **Add CI** (S · engineering) — _done v1.32.0._ GitHub Actions
  (`.github/workflows/ci.yml`) runs `lint` + `test` + `build` on PRs and pushes
  to `main`. Also set up ESLint (`.eslintrc.json`) so `next lint` runs
  non-interactively, and fixed the one lint error. _REVIEW §1.1._
- [x] **Automate dependency updates & keep Next patched** (S · security) —
  _done v1.32.0._ Dependabot (`.github/dependabot.yml`, weekly npm + actions).
  Next is already on the latest 14.2.x (14.2.35); the advisory's clean fix is a
  major bump — tracked, not a quick win. _REVIEW §2.6._

## P2 — next

- [x] **Cap import size in `parseProfile`** (S · security) — _done v1.33.1._
  Rejects >2 MB files, skips values >256 KB, caps keys at 500, with warnings.
  Covered by `test/profile.test.ts`. _REVIEW §2.3._
- [ ] **Consolidate per-view default values** (S · engineering) — one
  `lib/<view>Defaults.ts` imported by the component, `run.ts`, and the route so
  they can't drift. _REVIEW §1.2._
- [ ] **Adopt zod for API request validation** (M · engineering) — one schema per
  route; infer request types from it; structured 400s. _REVIEW §1.3._
- [ ] **Shareable scenario URLs** (M · UX/marketing) — encode view+inputs into a
  compressed querystring (`lz-string`); add OG image + SEO meta so shared links
  render nicely. Growth + UX. _REVIEW §3.5, §4._
- [x] **Accessibility pass on inputs** (M · UX) — _done v1.34.0._ Click-to-type
  exact values + `aria-label`/`aria-valuetext` on sliders (`Field`), nav-menu
  focus trap + restore (`NavMenu`), and a global `prefers-reduced-motion` rule.
  _REVIEW §3.2._
- [ ] **Nonce-based strict CSP** (M · security) — upgrade `middleware.ts` to a
  nonce + `strict-dynamic` `script-src` (drops `'unsafe-inline'`). Requires
  switching the app to dynamic rendering so Next can stamp the per-request nonce
  onto its script tags. _REVIEW §2.2._
- [ ] **[Strategic] Move simulations to a client-side Web Worker** (L ·
  founder/security) — models are pure TS; running them in a Worker removes the
  serverless DoS/cost surface, improves privacy, and keeps UX identical. Keep the
  API as an optional fallback. Highest long-term leverage. _REVIEW §2.1, §5._
- [x] **Guard against future spreadsheet-injection** (S · security) — _done
  v1.33.1._ `sanitizeCell` in `lib/excel/workbooks.ts` (+ doc + test). Not
  exploitable today (numeric-only). _REVIEW §2.4._
- [x] **Regression test for Excel output** (S · engineering) — _done v1.33.1._
  `test/excel.test.ts` locks chart/drawing parts, content types, and
  sheet→drawing wiring. _REVIEW §1.4._

## P3 — nice-to-have

- [ ] **Gate Monte Carlo export until after a run** (S · UX) — or relabel "Export
  current inputs"; Tax (deterministic) can stay always-on. _REVIEW §3.3._
- [ ] **Sanitize client-facing error messages** (S · security) — generic message
  to the client, detail to server logs. _REVIEW §1.5._
- [ ] **Reduce result density** (S · UX) — a one-line "what this means" per view;
  progressive disclosure of advanced knobs. _REVIEW §3.4._
- [ ] **Optional privacy-respecting analytics** (S · marketing) — Plausible /
  Vercel Web Analytics (cookieless), disclosed in PRIVACY.md, only if roadmap data
  is wanted. _REVIEW §4._
- [ ] **Optional error monitoring** (S · ops) — Sentry with PII scrubbing.
  _REVIEW §1.5._
- [ ] **Region framing for tax** (S · legal) — label the Tax view "US-focused"
  and keep the 2024-federal-only caveats on results. _REVIEW §6.3._

---

_When you finish an item, check it off and note the version it shipped in. Keep
this list and [docs/REVIEW.md](docs/REVIEW.md) in sync._
