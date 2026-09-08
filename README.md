# Monty Carlo Simulator

A web version of [Bobs-Dev-Attic/MonteCarloSimulator](https://github.com/Bobs-Dev-Attic/MonteCarloSimulator)
(originally a Flutter + Firebase + Python app), rebuilt as a **Next.js** app that
deploys to **Vercel** with zero configuration.

Instead of relying on a single static prediction, it runs thousands of
randomized scenarios to show the full spectrum of possible financial outcomes
and their probabilities — and has grown well beyond the original two models into
a suite of retirement-planning tools.

The current version is shown in the header badge and footer, and links to
[`CHANGELOG.md`](CHANGELOG.md), which documents every release.

## Views

Navigation is via the menu button (top-left); each view has its own icon, shown
in the menu and next to the page title.

| View | What it answers |
|------|-----------------|
| **Portfolio forecast (GBM)** | How a single-asset portfolio might grow, with fat-tail (Student-t) returns as an option. |
| **Retirement plan** | Save → withdraw over a lifetime; headline **probability of not running out of money**. |
| **Dynamic withdrawals** | Guyton-Klinger **guardrails** and a Kitces-style **ratchet** vs. fixed real spending. |
| **Sequence risk** | Sizes a **cash buffer / bond tent** so you're not forced to sell equities in an early-retirement trough, with optional ongoing buffer refilling and a rolling-bucket-vs-static-tent comparison. |
| **Longevity** | Replaces a fixed horizon with a stochastic lifespan (**Gompertz** mortality), including **joint life** for couples and the chance of outliving your money. |
| **Long-term care** | A 4-state **Markov** health model (Active → Assisted → Skilled → Deceased) with per-state care costs, showing the extra ruin risk care adds. |
| **Tax & Roth** | Multi-account (**Taxable / Tax-deferred / Roth**) drawdown with **Roth conversions**, **RMDs**, and bracket management — naive vs. tax-smart, after-tax terminal wealth. |
| **Reverse stress test** | Solves for the return/withdrawal/shock that would *cause* failure. |
| **Macro shock** | Overlays geopolitical / market-crash scenarios on the baseline forecast. |
| **Sensitivity** | A tornado chart ranking which inputs move the outcome most. |
| **Multi-asset** | A correlated multi-asset portfolio with optional rebalancing and a diversification-benefit readout. |
| **Risk glide path** | An allocation that de-risks over time between a risky and a safe sleeve. |
| **Stress compare** | Every scenario in the library run side by side against one portfolio (common random numbers). |
| **Preferences** | Themes, display options, input ranges/defaults, and profile import/export. |

## Simulation models

The two original models are ported faithfully to TypeScript:

1. **Portfolio forecast (GBM)** — Geometric Brownian Motion:

   ```
   S_{t+1} = S_t · exp((μ − ½σ²)·dt + σ·√dt·Z),   Z ~ N(0, 1)
   ```

   Discretized at 252 trading days/year. An optional **Student-t** distribution
   models fat tails at the same volatility.

2. **Retirement plan** — accumulation + inflation-adjusted withdrawal, reporting
   the **probability of not running out of money**.

Each run returns compact aggregates (not raw paths): percentile bands over time
(the fan chart), a histogram of terminal values, and scalar risk/return
statistics (median, mean, P5/P95, 95% VaR, probability of loss, success rate) —
matching `functions/montecarlo/aggregate.py` from the original.

The additional views add their own models in `lib/`:

- `dynamicWithdrawal.ts` — guardrails / ratchet withdrawal rules.
- `sequenceRisk.ts` — early-bear stress with cash-buffer / bond-tent sizing.
- `mortality.ts` — Gompertz survival + joint-life longevity.
- `careCosts.ts` — Markov health-state care-cost model.
- `tax.ts` — deterministic multi-account tax / Roth-conversion / RMD projection.
- `multiasset.ts`, `glidepath.ts`, `sensitivity.ts`, `reverse.ts`,
  `scenarios.ts` (macro / stress library).

## App features

- **Theming** — a dark/light toggle plus multiple color themes (Amber, Ocean,
  Emerald, Violet, Rose, Slate, Dark, Light, 2-Tone, High Contrast). Charts are
  theme-aware.
- **Real vs. nominal** — a global toggle shows results in today's dollars or
  nominal dollars.
- **Progress dialog** — long runs show a modal with a progress bar, percentage,
  and estimated time to completion.
- **Run history** — every model-driven view logs its runs (inputs + headline
  metrics) to a per-view history you can restore from or clear.
- **Glossary tooltips** — inputs and outputs have plain-language explanations
  with links to reputable sources.
- **Import / export** — save all settings, per-view inputs, theme, display
  options, run history, **and which view you last had open** to a JSON file, and
  re-import selectively (see below).
- **Export to Excel** — Tax & Roth, Sequence risk, and the Portfolio /
  Retirement forecast each generate a shareable `.xlsx` with **native, editable
  Excel charts**. Tax & Roth is written as a **live-formula model** (editable
  assumptions drive year-by-year formulas), so the recipient can change an
  assumption in Excel and the whole projection — and its charts — recompute.
- **Auto-run** — an off-by-default preference that runs a view once after its
  inputs hydrate.

## Import / export of settings

The Preferences view can export a **profile** — a JSON snapshot of everything
persisted in the browser (`mcs.`-prefixed `localStorage` keys) — and import one
back, on either side choosing which **categories** to include:

- Preferences & theme, display options, and the **active view** (which page you
  last accessed).
- Every view's inputs (Portfolio, Retirement, Dynamic withdrawals, Sequence
  risk, Longevity, Long-term care, Tax & Roth, Reverse, Macro, Sensitivity,
  Multi-asset, Glide path, Stress compare).
- **Simulation history** (run logs across every view).

Export is complete by construction: it sweeps *all* persisted keys, so nothing a
view saves can be left out. Import **examines the file first** — it must carry
the correct format tag, and any foreign keys, prototype-polluting keys
(`__proto__` / `constructor` / `prototype`), or non-JSON values are dropped and
reported before anything is written. Importing a category does a targeted
replace of only that category, so importing (say) a theme won't wipe your
history.

## Export to Excel

Three views can generate a `.xlsx` workbook (via the `app/api/export/excel`
route, built server-side with ExcelJS) carrying **native Excel charts** — real,
editable chart objects bound to the cells, so they redraw if the recipient edits
the data:

- **Tax & Roth** is exported as a **working model**, not a data dump: an editable
  *Assumptions* sheet drives *Naive* and *Tax-smart* sheets whose entire
  year-by-year projection is Excel formulas (inflation-indexed 2024 brackets, a
  progressive-tax formula, RMD lookups, bracket-fill Roth conversions), plus a
  *Summary* sheet with the strategy comparison and charts. Change an assumption
  in Excel and everything recomputes. The formulas reproduce the app's own
  engine to the dollar.
- **Sequence risk** and the **Portfolio / Retirement forecast** export their
  result tables (buffer sweeps, percentile bands, histograms, summary stats)
  with matching charts.

ExcelJS cannot emit native charts, so `lib/excel/charts.ts` injects the chart /
drawing OOXML into the generated workbook; `lib/excel/workbooks.ts` builds the
per-view sheets and chart definitions.

## Architecture

| Original | This web version |
|----------|------------------|
| Flutter UI | Next.js (App Router) + React + Tailwind + Recharts |
| Python Cloud Functions (NumPy) | Next.js Route Handlers (`app/api/simulate/*`) — Node serverless functions |
| Firestore | none needed — compute is stateless; user state lives in the browser (`localStorage`) |

The simulation core lives in `lib/` with **no framework dependencies**,
mirroring how the original kept its models free of Firebase so they could be
tested and reused. The API routes do the CPU-bound work server-side and return
only aggregated results, exactly like the original Cloud Function design.

> **Note on reproducibility:** the original uses NumPy's PCG64 generator. This
> port uses a seeded mulberry32 + Box–Muller sampler, so a `seed` still gives
> fully reproducible runs and values are drawn from the correct distributions,
> but the exact number stream differs from NumPy.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build (also type-checks everything)
npm run start      # serve the production build
```

## Deploy to Vercel

This repo is a standard Next.js app — no special setup required.

- **One click:** import the GitHub repo at [vercel.com/new](https://vercel.com/new).
  Vercel auto-detects Next.js; leave build/output settings at their defaults.
- **CLI:**

  ```bash
  npm i -g vercel
  vercel          # preview deploy
  vercel --prod   # production deploy
  ```

`vercel.json` gives the simulation API routes extra memory and a longer max
duration so large runs (up to 50,000 paths) finish comfortably.

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css     UI shell + interactive page (nav, GBM & retirement)
  api/simulate/<model>/route.ts         one POST route per model:
    gbm, retirement, dynamic-withdrawal, sequence-risk, longevity,
    care-costs, tax, macro, multiasset, glidepath, sensitivity, stress-compare
components/
  Chart / UI       FanChart, Histogram, StatCards, Field, CompareView, ConsentGate
  Views            DynamicWithdrawal, SequenceRisk, Longevity, CareCosts, TaxPlanner,
                   ReverseStress, MacroShock, Sensitivity, MultiAsset, RiskGlidePath,
                   StressCompare, PreferencesPage
  Shared UI        NavMenu, NavIcons, ThemeToggle, ProfileBar, ProfileDialog,
                   RealToggle, InfoTip, HistoryPanel, TabHistoryPanel, GlidePathEditor
lib/
  rng.ts           seedable RNG + Gaussian sampler
  gbm.ts, retirement.ts, multiasset.ts, glidepath.ts, dynamicWithdrawal.ts,
  sequenceRisk.ts, mortality.ts, careCosts.ts, tax.ts, sensitivity.ts, reverse.ts,
  scenarios.ts     the simulation / analysis models
  aggregate.ts     percentile bands / histogram / summary stats (port of aggregate.py)
  run.ts           orchestration → compact JSON responses
  persist.ts, tabHistory.ts, history.ts   localStorage state + per-view run history
  preferences.tsx, themes.ts, chartColors.ts, real.ts, realContext.tsx   prefs & theming
  profile.ts, profileCategories.ts        import / export of settings
  progress.tsx, progressEstimator.ts      progress dialog + ETA
  broadcast.tsx    "apply to all views" input broadcasting
  glossary.ts      tooltip content
  format.ts, types.ts
```

## API

`POST /api/simulate/gbm`

```json
{ "beginningValue": 10000, "mu": 0.07, "sigma": 0.15, "years": 10,
  "stepsPerYear": 252, "nSims": 10000, "contributionPerStep": 0, "seed": 2026 }
```

`POST /api/simulate/retirement`

```json
{ "startingBalance": 100000, "annualContribution": 15000, "yearsToRetire": 25,
  "retirementYears": 30, "annualWithdrawal": 60000, "meanReturn": 0.06,
  "stdReturn": 0.12, "inflation": 0.025, "nSims": 10000, "seed": 2026 }
```

The GBM and retirement routes return
`{ model, bands, histogram, summary, samplePaths, xAxis, meta }`. The other
`/api/simulate/*` routes each accept that view's inputs and return a shape
tailored to that model (see the matching `lib/` module and component).

---

Educational tool — not financial advice. US tax figures in the Tax & Roth view
are 2024 federal only (no state / IRMAA / NIIT / ACA / Social Security taxation).
