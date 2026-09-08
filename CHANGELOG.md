# Changelog

All notable changes to this project are documented here. The version shown in
the website footer (and header badge) corresponds to the `version` field in
`package.json` and links back to this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.31.0] - 2026-09-08

### Added
- **Export to Excel.** Three views now generate a shareable `.xlsx` workbook
  with **native, editable Excel charts** (real chart objects bound to the data,
  not images):
  - **Tax & Roth** — exported as a **live-formula model**: an editable
    Assumptions sheet drives year-by-year Naive and Tax-smart projections
    written entirely as Excel formulas (inflation-indexed 2024 brackets, a
    progressive-tax formula, RMD lookups on the Uniform Lifetime Table, and
    bracket-fill Roth conversions), plus a Summary sheet with the strategy
    comparison and three charts. Editing an assumption in Excel recomputes the
    whole projection — a working model the recipient can use, not a data dump.
    The formulas were verified to reproduce the app's engine to the dollar.
  - **Sequence risk** — buffer-sweep, refill-on/off comparison, and
    equity-path tables with vulnerability, ruin, ending-balance, and
    bear-window charts.
  - **Portfolio forecast** and **Retirement plan** — summary statistics,
    percentile-band, and terminal-distribution sheets with a bands line chart
    and a histogram column chart.

  A new server route (`app/api/export/excel`) builds the workbook with ExcelJS
  and injects the chart XML; each view has an **Export to Excel** button.

## [1.30.0] - 2026-09-08

### Added
- **Per-view icons.** Every view now has a unique, representative line icon,
  shown both in the navigation menu (in a rounded chip beside each entry) and
  next to the page title on the view itself.
- **Run history for Sequence risk.** The sequence-risk view now logs each run
  (inputs + recommended buffer, no-buffer ruin, and trough-sale risk) to a
  restorable per-view history, matching the other model views. It is included in
  profile export / import via the existing history category. (Tax & Roth,
  Long-term care, and Longevity already had run history.)

### Changed / confirmed
- **Complete export / import.** Confirmed the profile export sweeps *all*
  persisted settings — every view's inputs, preferences & theme, display
  options, run history across all views, **and the active view** (which page was
  last open, `ui.tab` / `ui.model`) — and that import re-applies them by
  category. Documented the guarantee.
- **README** rewritten to cover the full app: all views, the simulation models,
  theming, real/nominal, the progress dialog, run history, glossary tooltips,
  auto-run, and the selective import/export of settings (including the
  last-accessed view), plus an updated project layout and API section.

## [1.29.0] - 2026-09-08

### Added
- **Tax & Roth view (multi-account tax sinking).** A deterministic year-by-year
  projection across **Taxable, Tax-deferred (IRA/401k), and Tax-free (Roth)**
  buckets that compares a naive drawdown against a tax-smart plan filling a
  target bracket with **Roth conversions** each year. Models **RMDs** (IRS
  Uniform Lifetime Table, starting age 73), 2024 federal ordinary brackets and
  the standard deduction (both indexed to inflation), a flat long-term
  capital-gains rate on realized taxable gains, and bracket-fill conversions up
  to a chosen rate (10/12/22/24/32%). Reports the after-tax terminal-wealth gain
  and lifetime tax saved, a naive-vs-smart strategy table (terminal wealth,
  lifetime taxes, total RMDs, total conversions, depletion year), a stacked-area
  chart of account balances shifting from tax-deferred into Roth over time, and
  annual tax / RMD / conversion flows showing conversions front-loaded before the
  RMD cliff. Records to run history and is included in export / import.
  Educational only — not tax advice; US federal only, no state / IRMAA / NIIT /
  ACA / Social Security taxation.

## [1.28.0] - 2026-09-08

### Added
- **Long-term care view (Markov health-state model).** Simulates yearly
  transitions through **Active → Assisted living → Skilled nursing → Deceased**
  with age-rising probabilities, adding large per-state care costs on top of base
  living spend — the sudden late-life step-ups a flat spend can't capture. The
  portfolio is run **with and without** care costs on the same paths (common
  random numbers) to isolate the extra ruin risk. Shows the probability of ever
  needing care, median years in care and lifetime care cost (with its long right
  tail), a state-occupancy-by-age chart, and ruin with vs. without care. Records
  to run history and is included in export / import. Transition rates and costs
  are educational defaults (US ballpark), all adjustable.

## [1.27.0] - 2026-09-08

### Added
- **Longevity & mortality view** — replaces a fixed retirement horizon with a
  stochastic lifespan drawn from a Gompertz mortality curve (tunable by age, sex,
  and a health/longevity adjustment). For **couples** it models **joint life** —
  the plan lasting until the second death — with an adjustable survivor-spending
  drop after the first death. Surfaces longevity tail-risk (probability of
  reaching 85 / 90 / 95 / 100, individually and either-survivor), the
  distribution of how many years the plan must last, and the **chance of
  outliving your money** from a real decumulation over the sampled lifespans.
  Records to run history and is included in export / import. The mortality curve
  is an educational approximation, not a specific actuarial table.

## [1.26.0] - 2026-09-08

### Added
- **Run history on more views.** Dynamic withdrawals, Sensitivity, Multi-asset,
  Risk glide path, and Stress compare now each keep a history of past runs
  (timestamp, a label, and headline metrics), with **Restore** to load a run's
  inputs back into the form, plus per-entry delete and clear-all. Stored per view
  under `mcs.history.<view>.v1`.
- These histories are included in **profile export / import** under the existing
  "Simulation history" category, and the export/import dialog's run count now
  sums runs across every view's history (not just Portfolio / Retirement).

## [1.25.0] - 2026-09-08

### Changed
- **Auto-run is now a preference, off by default.** Views no longer run a
  simulation automatically when they open; open a view and press its Run button.
  A new **"Auto-run simulations on load"** toggle in Preferences → Display
  options turns the old behavior back on.

### Fixed
- When auto-run *is* enabled, it now waits for your saved inputs to load from the
  browser before running, so it uses your actual field values instead of the
  built-in defaults. (Previously the on-load run fired before persisted values
  had hydrated, so it always ran with defaults.)

## [1.24.0] - 2026-09-08

### Added
- **Rolling bucket vs. static tent comparison** in the Sequence risk view. Each
  run now computes both refill modes and shows them side by side — ruin
  probability and median ending balance across every buffer size, refill on vs.
  off — so the trade-off is visible without flipping the toggle and re-running.

## [1.23.0] - 2026-09-08

### Added
- **Rolling-bucket buffer refilling** in the Sequence risk model. A new "Refill
  buffer in good years" toggle (on by default) turns the cash buffer into a
  rolling bucket: when equities make a new high, some of the gains are moved into
  the buffer to top it back up to target, so it's replenished for future
  downturns rather than being a one-time bond tent that's spent down and never
  restored. Turn it off to model the static bond tent.

### Changed
- Sequence-risk trough detection now tracks a pure equity **return index**
  instead of the equity dollar balance, so withdrawals and buffer refills no
  longer distort when equities are considered "in a trough."

## [1.22.0] - 2026-09-08

### Added
- **Sequence-of-returns vulnerability analysis** — new "Sequence risk" view. It
  stresses equity returns over the first few years of retirement (an
  adjustable bear window) — when a downturn does the most lasting damage — and
  sweeps the size of a cash / short-bond **buffer (bond tent)** to quantify the
  smallest one that avoids being **forced to sell equities at a trough** during
  that window. Every buffer size is evaluated on the same stressed paths (common
  random numbers). Shows the recommended buffer in years and dollars, a
  vulnerability curve (probability of a forced trough sale and of ruin vs.
  buffer size), a buffer sweep table, and the median equity path with vs. without
  the buffer over the bear window. All figures in today's dollars.

## [1.21.0] - 2026-09-08

### Added
- **Dynamic withdrawal strategy simulation** — new "Dynamic withdrawals" view.
  Compares three ways of deciding retirement spending against the *same* market
  paths (common random numbers): **fixed** inflation-adjusted spending (the
  classic 4% rule), **Guyton–Klinger guardrails** (freeze the raise after a down
  year; cut when the withdrawal rate drifts too high, raise when it drifts too
  low), and a **ratcheting** rule (never cut; step spending up only after strong
  growth). Shows how much each rule changes the **probability of running out**
  versus fixed spending, plus the trade-off in spending stability — a comparison
  table (ruin probability, success, median ending balance, total lifetime
  spending, average years with a spending cut), a ruin-probability bar chart, and
  median real spending / balance over time. All figures are in today's dollars.

## [1.20.0] - 2026-09-08

### Added
- **Simulation progress dialog.** While a simulation runs, a modal shows a
  progress bar, a live percentage, and an estimated time to completion, then
  disappears automatically when the run finishes. Because runs are a single
  request/response with no incremental progress, the ETA is estimated from a
  rolling record of how long recent runs took (scaled by the amount of work) and
  self-calibrates to your device; the bar eases toward completion and only hits
  100% when the result actually arrives. Applies to every simulated view
  (Portfolio, Retirement, Macro shock, Sensitivity, Multi-asset, Risk glide
  path, Stress compare). The rolling timing cache is stored locally and is not
  part of your exported/imported profile.

## [1.19.0] - 2026-09-08

### Changed
- **Removed the current-view dropdown.** It duplicated the menu; navigation is
  now solely the menu button, and the active view is shown as a heading above
  the content.
- **Moved the light/dark toggle into the menu** (an "Appearance" footer in the
  slide-out drawer) instead of the header.
- **Moved the nominal/real ("today's $") toggle to Preferences** under a new
  **Display options** section. The "today's $" badge still marks charts shown in
  real terms.
- **More responsive layouts.** The app now uses a wider max width with larger
  gutters on big screens (so wide monitors aren't mostly empty margin), the
  header controls stack cleanly on small screens, and the glide-path sleeve
  inputs collapse to one column on narrow widths. Verified free of horizontal
  overflow from mobile (375px) through desktop (1440px).

## [1.18.0] - 2026-09-08

### Added
- **Selective export / import dialogs.** Export now opens a dialog to choose
  exactly which categories of settings to include — Preferences & theme,
  Portfolio, Retirement, Reverse stress, Macro shock, Sensitivity, Multi-asset,
  Risk glide path, Stress compare, Display options, Active view, and
  **Simulation history** (shown with its run count, confirming history is part of
  the JSON) — plus a custom file name.
- **Import dialog with validation.** Importing lets you pick the `.json` file,
  then *examines* it before anything is applied: it confirms the file is a valid
  Monty Carlo profile, shows when it was exported, and reports what it skipped.
  Foreign keys (anything not belonging to the app) are ignored and
  prototype-polluting keys (`__proto__` / `constructor` / `prototype`) are
  blocked, with oversized files refused. You then choose which categories to
  import; only those are replaced — the rest of your current settings are left
  untouched (a targeted replace instead of an all-or-nothing overwrite).

### Changed
- Settings are now organized into named categories (`lib/profileCategories.ts`)
  shared by both dialogs. The header Profile bar and the Preferences page both
  use the new dialogs.

## [1.17.0] - 2026-09-08

### Added
- **Light / dark theme toggle** in the header (sun / moon switch) that flips
  between light and dark, remembering the last palette used in each mode.
- **New color themes:** **Dark (neutral)**, **High Contrast** (black / white with
  vivid accents), **Light**, and **2-Tone (mono light)** — joining Amber, Ocean,
  Emerald, Violet, Rose, and Slate. Each theme now declares a light or dark
  *mode*, and the Preferences theme picker groups palettes under **Dark themes**
  and **Light themes** with a quick light/dark switch.

### Changed
- Themes now drive `color-scheme` and a set of light-mode text overrides so the
  same UI stays legible on light backgrounds.
- **Charts are theme-aware.** Grid lines, axes, tooltips, and median / reference
  markers read the active theme's colors at runtime (via a shared
  `useChartColors` hook), so the fan chart, histogram, tornado, macro, stress,
  glide-path, and compare views render correctly in every theme — including the
  new light palettes.

## [1.16.0] - 2026-09-08

### Added
- **Tooltips on result labels across every tab.** The info (ⓘ) popovers now
  extend beyond inputs to the *outputs*: the Macro shock result cards
  (median baseline/shocked, P5, 95% VaR, prob. of loss, paths hit, avg shocks,
  worst case), the Reverse stress result cards (target value, required &amp;
  total return, z-score, probability, likelihood, max withdrawal, max crash,
  money lasts), the Stress-compare table headers, and section headers on the
  Multi-asset (diversification, correlation matrix), Risk glide-path (glide-path
  effect, effective allocation), and Sensitivity (tornado, ranked impact) tabs.
- New glossary entries backing those labels: target/failure value, total
  return, likelihood (1-in-N), maximum sustainable withdrawal, maximum
  absorbable crash, shock frequency, worst case, and change vs. baseline.

### Changed
- Removed the "web edition" tag from the site header.

## [1.15.0] - 2026-09-08

### Changed
- Moved the **menu (hamburger) icon to the upper-left corner**, next to the
  title, and turned the current-view control into a **dropdown selector** for
  quick switching between views (the flyout drawer still opens from the icon).

## [1.14.0] - 2026-09-08

### Added
- **Menu + flyout navigation.** The tab row is replaced by a hamburger menu that
  opens a slide-out drawer listing every view (and Preferences), with the active
  view shown on the menu button.
- **Preferences page** with:
  - **Color themes** — six palettes (Amber, Ocean, Emerald, Violet, Rose, Slate)
    applied live via CSS variables and saved with your profile.
  - **Parameter ranges & defaults** — customize the slider min / max / step and
    default value for shared inputs (starting amount, expected return,
    volatility, horizon, simulations); ranges apply everywhere those inputs
    appear, and "Apply my defaults to all tabs" pushes your defaults out.
  - **Export / import** — download the full profile as JSON, import it back, or
    reset all settings.

### Changed
- Color tokens are now CSS variables, enabling runtime theming.

## [1.13.0] - 2026-09-08

### Added
- **Info tooltips (ⓘ) on inputs and results.** Every parameter field and summary
  statistic now has a small info icon that opens a plain-language explanation
  plus a "Learn more" link to a reputable external source (Investopedia /
  Wikipedia). Backed by a shared glossary (`lib/glossary.ts`) covering starting
  amount, expected return, volatility, horizon, simulations, contributions,
  withdrawals, inflation, real returns, correlation, diversification,
  rebalancing, glide path, macro shocks, degrees of freedom / fat tails,
  median / mean / percentiles / VaR / probability of loss / success rate, and
  more. Popovers render in a portal so they never clip.

## [1.12.0] - 2026-09-08

### Added
- **First-visit consent dialog.** On a visitor's first load, a modal requires
  them to tick a box acknowledging the tool is **not financial advice** and is
  for educational / entertainment purposes only before entering. The
  acknowledgement is stored locally (outside the profile namespace, so a profile
  reset/import doesn't clear it) and won't reappear on return visits.

## [1.11.0] - 2026-09-08

### Added
- **"Apply to all tabs"** control on shared parameters. A small icon next to
  the starting amount, expected return, volatility, time horizon, and simulation
  count broadcasts that value to the matching parameter in every other tab, so a
  single portfolio can be kept consistent across Portfolio, Retirement, Reverse
  stress, Macro shock, Sensitivity, Multi-asset, Risk glide path, and Stress
  compare.

## [1.10.0] - 2026-09-08

### Added
- **Stress-test comparison across all scenarios** — new "Stress compare" tab.
  Runs the baseline plus every macro scenario (recession, financial crisis,
  pandemic, geopolitical conflict, oil shock / stagflation, rate-hike) against
  the same portfolio on a shared random seed, then ranks them worst → best in a
  table (median, Δ vs baseline, P5, prob-of-loss, 95% VaR, paths hit), a
  median-impact bar chart, and an overlaid median-trajectory chart. Respects the
  real (today's $) toggle.

## [1.9.0] - 2026-09-08

### Added
- **Real (inflation-adjusted) returns toggle** — a global "Real (today's $)"
  switch in the header (with an adjustable inflation rate) restates every value
  output in today's purchasing power. Applies across the Portfolio, Retirement,
  Macro shock, Multi-asset, and Risk glide-path tabs — fan charts, terminal
  histograms, and summary statistics all deflate by (1+π)ᵗ. The toggle and rate
  persist and are captured by a Profile. Probabilities (prob-of-loss, success
  rate) are correctly left unchanged, and a "today's $" badge marks charts shown
  in real terms.

## [1.8.0] - 2026-09-08

### Added
- **Risk tolerance over time (glide path)** — new "Risk glide path" tab. An
  interactive, draggable timeline sets the allocation to a risky sleeve vs. a
  safe sleeve across the horizon (drag points, click to add, double-click to
  remove; numeric editing too), with quick presets (declining target-date,
  constant 60/40, rising equity). The simulation reads the allocation at each
  step and runs a continuously-rebalanced two-sleeve GBM with time-varying
  drift and volatility (`μ(t)=a·μ_risky+(1−a)·μ_safe`,
  `σ(t)=√(a²σ_r²+(1−a)²σ_s²+2a(1−a)ρσ_rσ_s)`), including optional annual
  contributions. Shows the effective allocation and portfolio volatility over
  time alongside the usual fan chart, histogram, and summary statistics.

## [1.7.0] - 2026-09-08

### Added
- **Fat-tailed (Student-t) returns** for the portfolio forecast. A distribution
  selector switches the per-step shock from Normal to a unit-variance Student-t
  with an adjustable degrees-of-freedom (ν); lower ν means fatter tails — more
  extreme booms and crashes — at the *same* target volatility. Sampled via a
  Marsaglia–Tsang Gamma generator for the chi-square denominator.
- **Profiles** — save and load all app settings locally. A Profile bar in the
  header exports every setting (inputs for all tabs plus your simulation
  history) to a single JSON file and imports it back on any device/browser, with
  a Reset-to-defaults control. Settings now persist in the browser between
  visits via a `localStorage`-backed state hook.

## [1.6.0] - 2026-09-08

### Added
- **Correlated multi-asset portfolio simulation** (new "Multi-asset" tab). Each
  asset follows its own GBM (its own μ/σ), with shocks linked through an editable
  **correlation matrix**; correlated returns are generated via Cholesky
  decomposition. Includes a roster of assets (US/International equities, bonds,
  gold, real estate) with editable weights, returns, volatilities, and pairwise
  correlations, plus optional **annual rebalancing**.
- Surfaces the **diversification benefit**: the portfolio's volatility
  (`√(wᵀΣw)`) versus the weighted-average volatility (the perfectly-correlated
  bound), alongside the blended expected return, fan chart, terminal-value
  histogram, and summary statistics for the total portfolio.

## [1.5.0] - 2026-09-08

### Added
- **Sensitivity analysis with a tornado chart** (new "Sensitivity" tab). Varies
  each input one-at-a-time by ±a chosen amount around the base case and ranks the
  inputs by their impact on a selected output metric (median, P5, probability of
  loss for the portfolio; success rate, median, P5 for retirement). The widest
  bar is the input the outcome is most sensitive to.
- Uses **common random numbers** (the same seed across every run) so each bar
  reflects the input change, not Monte Carlo sampling noise. Bars are colored by
  direction (does a higher input raise or lower the metric) around a base-case
  reference line, with a ranked-impact table beneath.

## [1.4.0] - 2026-09-07

### Added
- **Geopolitical / macroeconomic shock simulations** (new "Macro shock" tab).
  A jump-diffusion overlay on the portfolio model: discrete crashes strike with
  an annual probability, each an instantaneous drop followed by a window of
  elevated turbulence, plus an optional persistent drift drag. Includes a
  scenario library — mild recession, 2008-style financial crisis, pandemic
  crash, geopolitical conflict, oil shock / stagflation, rate-hike shock, and a
  fully custom scenario — and every shock parameter is tweakable.
- Each run is compared against the no-shock baseline: median impact, shift in
  probability of loss and VaR, expected number of shocks, share of paths hit,
  an overlaid baseline-vs-shocked median trajectory, and the shocked terminal
  distribution.

## [1.3.0] - 2026-09-07

### Added
- **Deterministic reverse stress testing** (new "Reverse stress test" tab).
  Instead of asking what outcomes are possible, it starts from a defined failure
  and solves — with closed-form math and monotonic root-finding, no random
  sampling — for the scenario that causes it:
  - **Portfolio:** for a chosen drawdown, the required constant annual return to
    reach it, plus how far into the tail that sits under your μ/σ (z-score,
    model-implied probability, and a "1-in-N" framing).
  - **Retirement:** whether the plan survives at the assumed return, the required
    return to last the full horizon, the maximum sustainable first-year
    withdrawal, the largest one-time crash at retirement it can absorb, and how
    long the money lasts.

## [1.2.0] - 2026-09-07

### Added
- **Simulation history:** every run is saved (in the browser) with its inputs
  and results. History can be exported as **JSON** or **CSV**, and any two runs
  can be **compared** side by side — a stat table with deltas plus overlaid
  median trajectories.
- Per-run delete and a Clear-all control for the history.

### Changed
- Portfolio forecast (GBM): maximum **Beginning value** raised from
  $1,000,000 to **$5,000,000**.

## [1.1.0] - 2026-09-07

### Added
- Version number displayed in the website header (badge) and footer, linking to
  this changelog.
- `CHANGELOG.md` to track versions and change history.
- App version is single-sourced from `package.json` and injected at build time
  via `NEXT_PUBLIC_APP_VERSION`, so the displayed number can never drift from the
  released version.

## [1.0.0] - 2026-09-07

### Added
- Initial web version of the Monte Carlo financial simulator, deployable to
  Vercel with zero configuration (Next.js App Router).
- **Portfolio forecast (GBM)** model — Geometric Brownian Motion, ported from
  the original `functions/montecarlo/gbm.py`.
- **Retirement plan** model — accumulation + inflation-adjusted withdrawal with
  probability of not running out of money, ported from `retirement.py`.
- Aggregation layer (percentile bands, terminal histogram, summary statistics:
  mean / median / P5 / P95 / 95% VaR / probability of loss / success rate),
  ported from `aggregate.py`.
- Seedable RNG (mulberry32 + Box–Muller) for reproducible runs.
- Serverless simulation API routes (`/api/simulate/gbm`,
  `/api/simulate/retirement`) mirroring the original client/server split.
- Interactive UI: model tabs, slider inputs, fan chart with percentile bands and
  sample trajectories, terminal-value histogram, and summary stat cards.

[1.31.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.31.0
[1.30.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.30.0
[1.29.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.29.0
[1.28.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.28.0
[1.27.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.27.0
[1.26.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.26.0
[1.25.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.25.0
[1.24.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.24.0
[1.23.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.23.0
[1.22.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.22.0
[1.21.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.21.0
[1.20.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.20.0
[1.19.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.19.0
[1.18.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.18.0
[1.17.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.17.0
[1.16.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.16.0
[1.15.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.15.0
[1.14.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.14.0
[1.13.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.13.0
[1.12.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.12.0
[1.11.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.11.0
[1.10.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.10.0
[1.9.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.9.0
[1.8.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.8.0
[1.7.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.7.0
[1.6.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.6.0
[1.5.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.5.0
[1.4.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.4.0
[1.3.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.3.0
[1.2.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.2.0
[1.1.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.1.0
[1.0.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.0.0
