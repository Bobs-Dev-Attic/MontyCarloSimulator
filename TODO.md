# TODO

Prioritized backlog from the review in [docs/REVIEW.md](docs/REVIEW.md). Ordered
so that quick, high-value hardening comes before larger investments. Each item
notes rough effort (S/M/L), the driving perspective, and the review section.

Legend: **P0** critical · **P1** high · **P2** medium · **P3** nice-to-have.

There are **no P0 items** — nothing is broken or actively exploitable; the finance
math is validated. The list is about hardening and future-proofing.

---

## P1 — do first

- [ ] **Add security headers** (S · security) — `headers()` in `next.config.mjs`:
  CSP (strict is easy — no third-party/inline scripts), `X-Frame-Options`/
  `frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy`. _REVIEW §2.2._
- [ ] **Add legal/baseline docs** (S · legal/founder) — `LICENSE` (MIT if
  intended), `PRIVACY.md`, `SECURITY.md` (disclosure contact), and a linkable
  "not advice" Terms note. _REVIEW §6.1._
- [ ] **State the privacy posture in-app + PRIVACY.md** (S · legal/marketing) —
  no PII, no tracking, on-device `localStorage` only, exports not stored, how to
  clear data. It's true today; make it explicit. _REVIEW §6.2._
- [ ] **Rate-limit the compute endpoints** (M · security/founder) — Vercel Firewall
  rules or `@upstash/ratelimit` keyed on IP for `/api/simulate/*` and
  `/api/export/excel`; consider lowering the public `nSims` cap. Prevents DoS /
  cost amplification. _REVIEW §2.1._
- [ ] **Cover the export route in `vercel.json`** (S · ops) — add
  `app/api/export/**` with sane `memory`/`maxDuration` (it runs a sim **and**
  builds a workbook; currently uses defaults). _REVIEW §2.1._
- [ ] **Add a test suite** (M · engineering) — **Vitest** for `lib/*` models:
  known-value checks, invariants (non-negative buckets, `afterTaxGain == smart −
  naive`), and determinism (seed ⇒ identical output). _REVIEW §1.1._
- [ ] **Add CI** (S · engineering) — GitHub Actions running `build` + `lint` +
  `test` on every PR. _REVIEW §1.1._
- [ ] **Automate dependency updates & keep Next patched** (S · security) —
  Dependabot/Renovate; track the Next.js advisory and plan the major upgrade.
  _REVIEW §2.6._

## P2 — next

- [ ] **Cap import size in `parseProfile`** (S · security) — limit total bytes,
  key count, and per-value size; clear message on reject. _REVIEW §2.3._
- [ ] **Consolidate per-view default values** (S · engineering) — one
  `lib/<view>Defaults.ts` imported by the component, `run.ts`, and the route so
  they can't drift. _REVIEW §1.2._
- [ ] **Adopt zod for API request validation** (M · engineering) — one schema per
  route; infer request types from it; structured 400s. _REVIEW §1.3._
- [ ] **Shareable scenario URLs** (M · UX/marketing) — encode view+inputs into a
  compressed querystring (`lz-string`); add OG image + SEO meta so shared links
  render nicely. Growth + UX. _REVIEW §3.5, §4._
- [ ] **Accessibility pass on inputs** (M · UX) — click-to-type exact values,
  `aria-valuetext` with the formatted display, nav-menu focus trap + restore,
  honor `prefers-reduced-motion`. _REVIEW §3.2._
- [ ] **[Strategic] Move simulations to a client-side Web Worker** (L ·
  founder/security) — models are pure TS; running them in a Worker removes the
  serverless DoS/cost surface, improves privacy, and keeps UX identical. Keep the
  API as an optional fallback. Highest long-term leverage. _REVIEW §2.1, §5._
- [ ] **Guard against future spreadsheet-injection** (S · security) — when any
  free-text field reaches an exported cell, prefix `= + - @` values with `'`.
  Document in `lib/excel/workbooks.ts`. Not exploitable today (numeric-only).
  _REVIEW §2.4._
- [ ] **Regression test for Excel output** (S · engineering) — assert emitted
  chart/drawing XML is well-formed and rels/content-types are wired; keep the
  API-vs-`formulas` value check. _REVIEW §1.4._

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
