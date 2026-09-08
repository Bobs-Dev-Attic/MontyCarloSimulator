# Changelog

All notable changes to this project are documented here. The version shown in
the website footer (and header badge) corresponds to the `version` field in
`package.json` and links back to this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
