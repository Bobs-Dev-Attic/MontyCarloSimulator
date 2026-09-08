# Project Review — Monty Carlo Simulator

_A multi-perspective review of the codebase as of v1.31.1. Findings are grouped
by reviewer lens; each is tagged with a severity and, where useful, a concrete
file reference and a suggested alternative. The prioritized, actionable version
of this lives in [TODO.md](../TODO.md); this document is the reasoning behind it._

Severity legend: **P0** critical / **P1** high / **P2** medium / **P3** low-nice-to-have.

---

## Executive summary

This is a well-structured, genuinely impressive hobby/education app: a clean
separation between framework-free simulation models (`lib/*.ts`) and thin API
routes, faithful ports of the original Python models, deterministic seeded RNG,
memory-conscious aggregation, thoughtful UX (theming, tooltips, run history,
progress dialog), and a standout feature — **live-formula Excel export**. Code
quality is above typical for the genre.

The gaps are the ones you'd expect from fast, feature-first iteration, and they
cluster in **operational hardening** rather than correctness:

1. **No automated tests and no CI** — the single biggest risk to future change.
2. **No abuse protection on public compute endpoints** (rate limiting) and **no
   security headers**.
3. **No legal/licensing/privacy docs** for a public-facing financial tool.

None are hard to fix; several are an afternoon each. The finance math itself has
been validated repeatedly (engine vs. Excel-formula reproduction to the dollar)
and is the strongest part of the app.

---

## 1. Software Engineer

### 1.1 Testing & CI — **P1**
- **No test files exist** (`npm test` → `node --test` finds nothing). The
  simulation models are pure functions — the easiest possible thing to test — and
  they're the part where a silent regression would be most damaging.
- **No CI pipeline** (no `.github/workflows`). Nothing enforces build/lint/type
  on a PR.
- **Recommendation:** adopt **Vitest** (TS-native, no compile step, fast) for unit
  tests of `lib/*` models — assert known values (e.g. 4%-rule ruin, joint-life
  survivor probability, tax terminal wealth), invariants (non-negative buckets,
  `afterTaxGain == smart − naive`), and **determinism** (same seed ⇒ identical
  output). Add a GitHub Actions workflow running `build` + `lint` + `test` on PRs.
  Keep the existing HTTP/`formulas` export checks as an integration test.

### 1.2 Duplicated default values — **P2**
- Some views define the same default in three places: the component
  (`usePersistentState`), the `run.ts` wrapper fallback, and the API route
  fallback (e.g. the recent `tax.taxable` change touched all three). This invites
  drift.
- **Recommendation:** a single `lib/<view>Defaults.ts` (or a `DEFAULTS` map)
  imported by all three. Reduces rework and the class of bug where the UI default
  and server fallback disagree.

### 1.3 API input validation — **P2**
- Routes hand-roll validation with a `num()` coercer and a few range checks.
  It's serviceable but inconsistent (some routes range-check, others only clamp),
  and error messages are ad hoc.
- **Recommendation:** define **zod** schemas per route (one source of truth for
  types + validation + safe parsing + structured 400s). Bonus: infer the request
  TS types from the schema instead of `as` casts.

### 1.4 Hand-rolled OOXML charts — **P3 (documented risk)**
- `lib/excel/charts.ts` injects chart XML by hand because ExcelJS has no chart
  support. It's careful and validated, but schema-fragile.
- **Recommendation:** keep it (it works and is well-commented), but add a small
  regression test that validates the emitted chart/drawing XML is well-formed and
  that content-types + rels are wired (this was checked manually; make it
  permanent). If chart needs grow, a Python microservice (`xlsxwriter`/`openpyxl`
  have native charts) is an alternative — but not worth it today.

### 1.5 Error surface — **P3**
- Routes return `err.message` to the client. Low risk here (messages are generic),
  but it's a habit worth breaking before any secret-bearing code is added.
- **Recommendation:** return a generic message + log detail server-side.

### 1.6 Reproducibility caveat (already documented) — informational
- RNG is mulberry32 + Box–Muller, not NumPy's PCG64, so the number stream differs
  from the original Python (distributions are correct). This is documented in the
  README and is fine; just don't let anyone expect bit-identical parity.

---

## 2. Security analyst / white-hat

Threat model: a public, unauthenticated, stateless web app that collects no PII
and stores everything client-side. Attack surface is small **but not zero.**

### 2.1 Unthrottled compute endpoints (DoS / cost) — **P1**
- `/api/simulate/*` accept `nSims` up to 50,000 and multi-year horizons; the work
  is `O(nSims × steps × …)` (sequence-risk also × buffer sizes × on/off). A script
  can hammer these serverless functions → **wall-clock exhaustion and Vercel cost
  amplification**. `/api/export/excel` is heavier still (runs a sim **and** builds
  a workbook) and is **not covered by `vercel.json`** function limits.
- **Mitigations (any/all):** rate limiting (**Vercel Firewall / rate-limit rules**,
  or `@upstash/ratelimit` + Upstash Redis keyed on IP), lower the public `nSims`
  cap, and add `app/api/export/**` to `vercel.json` with sane `memory`/`maxDuration`.
- **Stronger architectural option (see §3.4):** run the simulations **client-side in
  a Web Worker**. It removes this attack surface entirely, cuts hosting cost to ~0,
  and improves privacy. The models are pure TS and already framework-free, so this
  is very feasible; keep the API as an optional fallback.

### 2.2 No security headers — **P1**
- `next.config.mjs` sets no headers; there's no middleware. Missing:
  `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`,
  `Permissions-Policy`.
- **Recommendation:** add a `headers()` block in `next.config.mjs` (or middleware).
  A strict CSP is easy here because there are **no third-party scripts** and no
  inline `eval` (verified). This is high-value, low-effort.

### 2.3 Import (`parseProfile`) is good — with one gap — **P2**
- **Strengths (verified):** rejects non-JSON, wrong format tag, foreign keys, and
  **prototype-pollution keys** (`__proto__`/`prototype`/`constructor`); only writes
  `mcs.`-prefixed keys; reports what it skipped. This is the right shape.
- **Gap:** no cap on total size, key count, or per-value size. A crafted profile
  could bloat `localStorage` or jank the tab (client-side self-DoS; low severity).
- **Recommendation:** cap bytes / key count / value size in `parseProfile` and
  surface a clear message.

### 2.4 Spreadsheet-injection (CSV/formula injection) — currently safe, guard forward — **P2**
- The Excel export currently writes **only numeric, validated inputs** and static
  labels into cells, and `lib/excel/charts.ts` XML-escapes chart text. So there is
  no user-controlled string reaching a formula/cell today.
- **Guard:** if any free-text field is ever added to an exported view, sanitize
  cells beginning with `= + - @` (prefix with `'`) to prevent formula injection when
  the file is opened elsewhere. Document this in `lib/excel/workbooks.ts`.

### 2.5 XSS surface — low — informational
- No `dangerouslySetInnerHTML`, `eval`, or `innerHTML` anywhere (verified); all
  rendered values are numeric and React-escaped. Keep it that way; a CSP (§2.2) is
  defense-in-depth.

### 2.6 Dependency advisories — **P1/P2**
- `npm audit`: a **high** Next.js advisory (pre-existing; the clean fix is a major
  bump) and a **moderate** transitive `uuid` advisory via exceljs (affects an
  unused code path). Neither is currently exploitable in this app's usage.
- **Recommendation:** stay on the latest patched **14.2.x** Next.js and schedule a
  planned major upgrade; add Dependabot/Renovate so this doesn't rot.

### 2.7 SSRF / secrets / auth — not applicable (good)
- No outbound fetches from server routes, no secrets, no auth, no DB. This is a
  deliberately small blast radius — worth preserving as features grow.

---

## 3. UX designer

### 3.1 Strengths
- Consistent per-view layout, theme system, plain-language tooltips, run history,
  a progress dialog with ETA, per-view icons, and honest empty/loading states.
  The consent gate sets expectations well.

### 3.2 Input precision & accessibility — **P2**
- Inputs are `<input type="range">` sliders (keyboard-operable, good) but there's
  **no text entry** for an exact value, and no `aria-valuetext` carrying the
  formatted display (screen readers announce the raw number, not "$60,000").
- **Recommendation:** allow click-to-type on the value, add `aria-valuetext`, ensure
  the nav menu traps focus and restores it on close, and honor
  `prefers-reduced-motion` for chart/þtransition animation.

### 3.3 Export affordances — **P3**
- "Export to Excel" is always enabled, including before a run (the forecast export
  recomputes server-side, so the file is valid, but the user has no on-screen result
  to compare it to). Minor confusion.
- **Recommendation:** for the Monte Carlo views, enable export after a run (or label
  it "Export current inputs"). Tax is deterministic, so always-on is fine there.

### 3.4 Result density — **P3**
- Some views (Tax, Sequence risk) are number-dense. The plain-language summary
  cards help; consider a one-line "what this means" on every view and progressive
  disclosure of the advanced knobs.

### 3.5 Shareability — **P2 (also a growth lever, see §4)**
- A user cannot share a scenario as a link — only via JSON/Excel files.
- **Recommendation:** encode view + inputs into the URL (compressed querystring, e.g.
  `lz-string`) so a scenario is a shareable/bookmarkable link. High UX and marketing
  value; also enables "permalink to this run" from history.

---

## 4. Marketer

- **Lead with the differentiator:** the **live-formula Excel export** is genuinely
  novel for a free web calculator — most tools export static numbers; this exports a
  *working model an advisor can audit and edit*. That's the headline.
- **Breadth is a story:** 12 analyses (guardrails, sequence risk, longevity,
  long-term care, Roth/RMD tax, stress library…) — position as "the retirement
  what-if lab," not "a calculator."
- **Missing growth loops — P2:** shareable scenario URLs (§3.5), Open Graph
  preview images, and SEO metadata (`app/layout.tsx` has minimal meta). A shared
  link that renders a nice OG card is the cheapest acquisition channel.
- **Privacy as a feature:** "runs entirely in your browser, no account, no tracking,
  your data never leaves your device" is both true (today) and a strong marketing
  message — say it prominently (ties to §6).
- **Analytics tension:** there is currently **no** product analytics, so there's no
  data to guide the roadmap. If added, use a **cookieless, privacy-respecting**
  option (Plausible / Vercel Web Analytics) and disclose it — don't undermine the
  privacy story with third-party trackers.

## 5. Founder / executive

- **Cost & scale risk (P1):** unthrottled serverless compute (§2.1) is a real
  bill-shock vector if the app ever gets traffic or is scraped. The
  **client-side-Web-Worker** architecture (§2.1/§3.5) is the highest-leverage move:
  near-zero marginal hosting cost, better privacy, no DoS surface — while keeping the
  product identical. Recommend prioritizing it before any growth push.
- **Maintainability risk (P1):** no tests/CI means every new feature is a
  regression risk carried by manual verification. Cheap to fix; do it before adding
  more surface.
- **Liability posture (P1):** it's a *financial* tool. The disclaimers are good, but
  ship a LICENSE, Terms, and Privacy statement before promoting it (§6).
- **Moat:** the Excel-model export + breadth of analyses is defensible and
  demo-friendly. Lean into "trustworthy, transparent, private."

## 6. Legal / privacy / ethics

### 6.1 Missing baseline docs — **P1**
- **No `LICENSE`**, `PRIVACY.md`, or `SECURITY.md`, and no Terms. For a public
  financial tool this is the most pressing non-code gap.
- **Recommendation:** add an open-source `LICENSE` (e.g. MIT) if that's the intent;
  a short **Privacy** statement (see below); a **SECURITY.md** with a disclosure
  contact; and a brief **Terms/"not advice"** page (the in-app disclaimer is good but
  a linkable page is better for a public launch).

### 6.2 Privacy posture — strong, should be stated — **P1/P2**
- **Verified:** no PII is collected, no server persistence, no analytics/trackers,
  no outbound calls; all state is `localStorage` on the user's device; exports are
  generated on request and streamed back (not stored).
- Under GDPR/CCPA this is about as low-risk as it gets. **Say so explicitly** in a
  `PRIVACY.md` and in-app: what's stored (settings/history in your browser), that it
  never leaves the device, and how to clear it (the existing "Reset"/clear-all).
- If Vercel Analytics or any third party is ever added, update the statement and
  prefer cookieless/consented options.

### 6.3 Financial-advice framing — good, keep tightening — **P2**
- Disclaimers exist (consent gate, footer, "not tax advice" on the Tax view). Keep
  the Tax view's US-2024-federal-only, no-state/IRMAA/NIIT/ACA/SS caveats visible on
  the results, and consider region-gating language ("US-focused") since brackets are
  US-specific.

### 6.4 Ethics — informational
- The tool is transparent about being illustrative and simplified, doesn't dark-
  pattern, and doesn't harvest data. Maintaining the "no tracking, on-device"
  stance is the ethical high ground and a differentiator — protect it in design
  reviews.

---

## Suggested better options / services (summary)

| Need | Current | Suggested |
|------|---------|-----------|
| Unit tests | none | **Vitest** (TS-native) for `lib/*`; keep Playwright for e2e |
| CI | none | **GitHub Actions** (build + lint + test on PR) |
| Input validation | hand-rolled `num()` | **zod** schemas per route |
| Abuse protection | none | **Vercel Firewall** rate limits or `@upstash/ratelimit` |
| Compute location | serverless per request | **Web Worker** client-side (cost/privacy/DoS win) |
| Security headers | none | `next.config` `headers()` / middleware (strict CSP is easy) |
| Dep freshness | manual | **Dependabot/Renovate**; stay on patched Next 14.2.x |
| Shareable state | JSON/Excel files | URL-encoded state (`lz-string`) + OG images |
| Analytics (optional) | none | **Plausible** / Vercel Web Analytics (cookieless), disclosed |
| Error monitoring (optional) | none | **Sentry** with PII scrubbing |
