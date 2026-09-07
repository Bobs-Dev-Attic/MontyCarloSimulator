# Changelog

All notable changes to this project are documented here. The version shown in
the website footer (and header badge) corresponds to the `version` field in
`package.json` and links back to this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.3.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.3.0
[1.2.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.2.0
[1.1.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.1.0
[1.0.0]: https://github.com/Bobs-Dev-Attic/MontyCarloSimulator/releases/tag/v1.0.0
