# AGENTS.md — working guide for AI agents (Codex, Claude Code, etc.)

This file exists so an agent can be productive **without re-reading the whole
tree**. Read this first; open specific files only when you touch them. Keep it
up to date when structure or workflow changes.

> Companion docs: **[TODO.md](TODO.md)** (prioritized backlog),
> **[docs/REVIEW.md](docs/REVIEW.md)** (multi-perspective code review),
> **[CHANGELOG.md](CHANGELOG.md)** (release history), **[README.md](README.md)**
> (product overview).

---

## 1. What this is

A **Next.js 14 (App Router) + TypeScript + Tailwind + Recharts** web app: a
Monte Carlo financial simulator. Deploys to Vercel. **Stateless server** — all
user state lives in the browser (`localStorage`, `mcs.` prefix). No database, no
auth, no PII collected, no analytics.

## 2. Commands

```bash
npm install
npm run dev          # dev server, http://localhost:3000
npm run build        # production build — this is the type-check gate (tsc runs here)
npm run start        # serve the production build (needed for API routes)
npm run lint         # next lint
npm test             # vitest run — unit tests for the lib/* models (test/*.test.ts)
```

There is **no separate `tsc`/typecheck script** — `npm run build` is the
type-check. Always build before shipping.

## 3. Repository map

```
app/
  page.tsx                     Shell + GBM/Retirement views + nav wiring + Excel/history
  layout.tsx, globals.css      App shell, theme CSS variables
  api/simulate/<model>/route.ts   One POST route per model (gbm, retirement,
                                  dynamic-withdrawal, sequence-risk, longevity,
                                  care-costs, tax, macro, multiasset, glidepath,
                                  sensitivity, stress-compare)
  api/export/excel/route.ts    Server-side .xlsx generation (kind: tax|seqrisk|forecast)
components/
  <View>.tsx                   One component per view (TaxPlanner, SequenceRisk, ...)
  Field, InfoTip, NavMenu, NavIcons, TabHistoryPanel, ProfileDialog, ConsentGate, ...
lib/
  rng.ts                       Seeded RNG (mulberry32 + Box–Muller; Student-t)
  gbm.ts retirement.ts multiasset.ts glidepath.ts dynamicWithdrawal.ts
  sequenceRisk.ts mortality.ts careCosts.ts tax.ts sensitivity.ts reverse.ts
  scenarios.ts                 The pure simulation/analysis models (NO framework deps)
  aggregate.ts                 percentile bands / histogram / summary stats
  run.ts                       Orchestration: run a model → compact JSON (the API calls this)
  excel/charts.ts              Injects native OOXML charts into an ExcelJS workbook
  excel/workbooks.ts           Builds the per-view sheets + chart defs
  persist.ts tabHistory.ts history.ts   localStorage state + run history
  preferences.tsx themes.ts chartColors.ts real.ts realContext.tsx   prefs + theming
  profile.ts profileCategories.ts       import/export of settings
  progress.tsx progressEstimator.ts     progress dialog + ETA
  glossary.ts broadcast.tsx format.ts types.ts
```

**Data flow:** component (inputs, `usePersistentState`) → `fetch('/api/simulate/<x>')`
→ route validates with `num()`/clamps → `run.ts` wrapper → pure model in `lib/`
→ compact JSON → component renders with Recharts.

## 4. Conventions (match these — do not invent new patterns)

- **Persisted state:** `usePersistentState("<view>.<field>", default)` (key auto-prefixed `mcs.`).
  A key's prefix decides its export/import category (`lib/profileCategories.ts`).
- **A new view** = model in `lib/` + `run.ts` wrapper + `app/api/simulate/<x>/route.ts`
  (copy an existing route: `num()` helper + range validation) + `components/<View>.tsx`
  + wire into `app/page.tsx` (Tab union, `NAV_ITEMS`, render branch) + a `NavIcons.tsx`
  entry + glossary keys + a `profileCategories.ts` entry.
- **Run history:** `useTabHistory("<view>")` + `<TabHistoryPanel>` (see any recent view).
- **Charts:** Recharts, theme-aware colors via `useChartColors()`.
- **Tooltips:** `<InfoTip term="key" />` with the key defined in `lib/glossary.ts`.
- **Determinism:** models take a `seed`; pass `seed: 2026` for stable UI/exports.
  Comparisons use **common random numbers** (same seed across strategies).
- **Money defaults live in 3 places** for some views (component default, `run.ts`
  fallback, route fallback) — keep them in sync (see TODO: consolidate).

## 5. Ship workflow (STANDING — follow every change)

1. Make the change. `npm run build` must pass.
2. Verify (below).
3. **Bump `package.json` semver** (UI badge reads it via `next.config.mjs`).
4. **Update `CHANGELOG.md`**: dated `## [x.y.z] - YYYY-MM-DD` entry **and** a
   `[x.y.z]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/vx.y.z` link line.
5. Commit with trailers:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and the `Claude-Session:` line.
6. Push to the working branch, open a PR, squash-merge, then reset the branch from
   the new `main` (`git fetch origin main && git checkout -B <branch> origin/main && git push --force-with-lease`).

## 6. Verification recipes (save yourself the rediscovery)

**Run the server in the background** (a plain `nohup ... &` does NOT survive a
Bash tool call — use the tool's background mode):
```
npm run start   # launch via the Bash tool with run_in_background: true
# then poll: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```
`pkill -f next-server` reliably exits 144 — harmless.

**Screenshot a view (Playwright, Chromium is pre-installed):**
```js
const { chromium } = require('playwright');   // run with NODE_PATH=/opt/node22/lib/node_modules
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
```
Dismiss the consent gate first: check the checkbox in `div[aria-labelledby="consent-title"]`,
click **Enter simulator**, wait for it to detach. A fresh browser context has empty
`localStorage`, so it shows first-run defaults.

**Verify Excel export math WITHOUT Excel** (LibreOffice cannot load files in this
sandbox — Java-less; do not rely on `soffice`). Use the pure-Python `formulas`
engine to evaluate the workbook and diff against the API:
```
pip install formulas openpyxl
# POST inputs to /api/export/excel -> foo.xlsx, POST same to /api/simulate/tax -> api.json
# then formulas.ExcelModel().loads("foo.xlsx").finish().calculate() and compare Summary cells
```
The Tax workbook is **live formulas**; they must reproduce `lib/tax.ts` to the
dollar (this is how a real formula bug — defined names colliding with cell
addresses like `R1`/`TH1` — was caught).

## 7. Gotchas / landmines

- **Excel defined names must not look like cell references.** `r1..r7`, `th1..th6`
  are invalid (they are cells R1.., TH1..). Use `taxRate1`, `taxTop1`, etc.
- **ExcelJS cannot emit charts** — `lib/excel/charts.ts` hand-injects OOXML. If you
  add a chart type, keep the OOXML element ordering (schema-sensitive) and register
  content types + drawing rels + the `<drawing>` element in the sheet.
- **exceljs/jszip are server-only** (used in the API route). Never import them into a
  client component — it would bloat the bundle. Client uses `lib/excelExport.ts` (fetch).
- **`stepValues` are downsampled to ≤120 steps** in `gbm.ts` on purpose — don't
  "fix" it into a full matrix (it would blow memory at 50k sims).
- **Simulation cost is per-request and unthrottled** (see TODO — rate limiting).
- **Playwright lives at `/opt/node22/lib/node_modules`**, not in project `node_modules`;
  `require('playwright')` with that `NODE_PATH` (not `playwright-core`).

## 8. Deploy / environment

- Vercel, zero-config Next.js. `vercel.json` sets memory/duration for both
  `app/api/simulate/**` and `app/api/export/**`.
- Version is single-sourced from `package.json` via `next.config.mjs` env
  `NEXT_PUBLIC_APP_VERSION`.
- **Security headers** (CSP + friends) are set in `middleware.ts`. The CSP uses
  `script-src 'self' 'unsafe-inline'` (not nonce) because pages are statically
  prerendered — a nonce/strict-dynamic CSP refuses Next's chunks and breaks
  hydration (verified). If you touch it, re-run the CSP check (load the app in
  Playwright and assert 0 console CSP violations + charts render).
- **CI** (`.github/workflows/ci.yml`) runs `lint` + `test` + `build`. ESLint is
  configured (`.eslintrc.json`); `npm run lint` must exit clean (warnings OK,
  errors fail CI).
