# Monty Carlo Simulator — Web Edition

A web version of [Bobs-Dev-Attic/MonteCarloSimulator](https://github.com/Bobs-Dev-Attic/MonteCarloSimulator)
(originally a Flutter + Firebase + Python app), rebuilt as a **Next.js** app that
deploys to **Vercel** with zero configuration.

Instead of relying on a single static prediction, it runs thousands of
randomized scenarios to show the full spectrum of possible financial outcomes
and their probabilities.

## Models

Both simulation models from the original project are ported faithfully to
TypeScript:

1. **Portfolio forecast (GBM)** — Geometric Brownian Motion:

   ```
   S_{t+1} = S_t · exp((μ − ½σ²)·dt + σ·√dt·Z),   Z ~ N(0, 1)
   ```

   Simulates a portfolio's value over time from an expected annual return (drift
   `μ`) and volatility (`σ`), discretized at 252 trading days/year.

2. **Retirement plan** — accumulation + withdrawal. Each year the balance grows
   by a normally-distributed random return; contributions are added during the
   accumulation phase and inflation-adjusted withdrawals are taken during
   retirement. The headline metric is the **probability of not running out of
   money**.

Each run returns compact aggregates (not raw paths): percentile bands over time
(the fan chart), a histogram of terminal values, and scalar risk/return
statistics (median, mean, P5/P95, 95% VaR, probability of loss, success rate) —
matching `functions/montecarlo/aggregate.py` from the original.

## Architecture

| Original | This web version |
|----------|------------------|
| Flutter UI | Next.js (App Router) + React + Tailwind + Recharts |
| Python Cloud Functions (NumPy) | Next.js Route Handlers (`app/api/simulate/*`) — Node serverless functions |
| Firestore | none needed (stateless compute) |

The simulation core lives in `lib/` (`rng.ts`, `gbm.ts`, `retirement.ts`,
`aggregate.ts`) with **no framework dependencies**, mirroring how the original
kept its models free of Firebase so they could be tested and reused. The API
routes do the CPU-bound work server-side and return only aggregated results,
exactly like the original Cloud Function design.

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
  layout.tsx, page.tsx, globals.css   UI shell + interactive page
  api/simulate/gbm/route.ts           POST → GBM simulation
  api/simulate/retirement/route.ts    POST → retirement simulation
components/                           FanChart, Histogram, StatCards, Field
lib/
  rng.ts          seedable RNG + Gaussian sampler
  gbm.ts          GBM model (port of gbm.py)
  retirement.ts   retirement model (port of retirement.py)
  aggregate.ts    percentile bands / histogram / summary stats (port of aggregate.py)
  run.ts          orchestration → compact JSON response
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

Both return `{ model, bands, histogram, summary, samplePaths, xAxis, meta }`.

---

Educational tool — not financial advice.
