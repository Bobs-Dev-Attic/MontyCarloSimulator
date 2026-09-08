/**
 * Plain-language explanations for every input and output in the app, each with
 * a link to a reputable external source for deeper reading. Keyed by a short id
 * used by the <InfoTip> component.
 */

export interface GlossaryEntry {
  title: string;
  body: string;
  href: string;
  source: string; // e.g. "Investopedia", "Wikipedia"
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // --- Core inputs ---
  beginningValue: {
    title: "Starting amount",
    body: "The capital the simulation begins with (your principal). Every path grows or shrinks from this value.",
    href: "https://www.investopedia.com/terms/p/principal.asp",
    source: "Investopedia",
  },
  mu: {
    title: "Expected return (μ)",
    body: "The average annual return you assume the asset earns over the long run — the drift of the model. Historical stock returns have averaged roughly 7–10% before inflation.",
    href: "https://www.investopedia.com/terms/e/expectedreturn.asp",
    source: "Investopedia",
  },
  sigma: {
    title: "Volatility (σ)",
    body: "The annualized standard deviation of returns — how much outcomes swing around the average. Higher σ means a wider range of results. Broad stock indices sit near 15–20%.",
    href: "https://www.investopedia.com/terms/v/volatility.asp",
    source: "Investopedia",
  },
  years: {
    title: "Time horizon",
    body: "How many years the simulation runs. Longer horizons let returns compound but also accumulate more uncertainty.",
    href: "https://www.investopedia.com/terms/t/timehorizon.asp",
    source: "Investopedia",
  },
  nSims: {
    title: "Simulations",
    body: "The number of independent random scenarios (paths) generated. More simulations give smoother, more reliable probability estimates.",
    href: "https://www.investopedia.com/terms/m/montecarlosimulation.asp",
    source: "Investopedia",
  },
  contribution: {
    title: "Contributions",
    body: "Money added to the portfolio on a regular schedule. Steady contributions smooth out entry prices over time (dollar-cost averaging).",
    href: "https://www.investopedia.com/terms/d/dollarcostaveraging.asp",
    source: "Investopedia",
  },
  withdrawal: {
    title: "Withdrawals",
    body: "Money taken out each year in retirement, here grown with inflation. The classic '4% rule' is a common starting point for a sustainable rate.",
    href: "https://www.investopedia.com/terms/f/four-percent-rule.asp",
    source: "Investopedia",
  },
  inflation: {
    title: "Inflation",
    body: "The annual rate at which prices rise and money loses purchasing power. Used to grow withdrawals and to convert to 'today's dollars'.",
    href: "https://www.investopedia.com/terms/i/inflation.asp",
    source: "Investopedia",
  },
  real: {
    title: "Real (inflation-adjusted) returns",
    body: "Values expressed in today's purchasing power by removing inflation. A nominal balance buys less in the future; real terms make horizons comparable.",
    href: "https://www.investopedia.com/terms/r/realrateofreturn.asp",
    source: "Investopedia",
  },

  // --- Models ---
  montecarlo: {
    title: "Monte Carlo simulation",
    body: "A method that runs many randomized scenarios to map the full range of possible outcomes and their probabilities, instead of a single point forecast.",
    href: "https://en.wikipedia.org/wiki/Monte_Carlo_method",
    source: "Wikipedia",
  },
  gbm: {
    title: "Geometric Brownian Motion",
    body: "The standard model for asset prices: returns are log-normal, driven by a drift (μ) and random shocks scaled by volatility (σ).",
    href: "https://en.wikipedia.org/wiki/Geometric_Brownian_motion",
    source: "Wikipedia",
  },
  fatTails: {
    title: "Fat tails (Student-t)",
    body: "A distribution with heavier tails than the normal curve, so extreme booms and crashes happen more often. Lower degrees of freedom (ν) means fatter tails.",
    href: "https://en.wikipedia.org/wiki/Fat-tailed_distribution",
    source: "Wikipedia",
  },
  nu: {
    title: "Degrees of freedom (ν)",
    body: "The parameter controlling the Student-t's tail thickness. Small ν → very heavy tails; as ν grows the shape approaches the normal distribution.",
    href: "https://en.wikipedia.org/wiki/Student%27s_t-distribution",
    source: "Wikipedia",
  },
  correlation: {
    title: "Correlation",
    body: "How two assets move together, from −1 (opposite) through 0 (unrelated) to +1 (in lockstep). Low correlations are what make diversification work.",
    href: "https://www.investopedia.com/terms/c/correlation.asp",
    source: "Investopedia",
  },
  diversification: {
    title: "Diversification",
    body: "Combining assets that don't move together to reduce overall volatility without giving up the same amount of return.",
    href: "https://www.investopedia.com/terms/d/diversification.asp",
    source: "Investopedia",
  },
  rebalance: {
    title: "Rebalancing",
    body: "Periodically trading back to your target weights — selling what grew and buying what lagged — to keep the intended risk level.",
    href: "https://www.investopedia.com/terms/r/rebalancing.asp",
    source: "Investopedia",
  },
  glidePath: {
    title: "Glide path",
    body: "A schedule that shifts the mix from riskier to safer assets over time, as in a target-date fund approaching retirement.",
    href: "https://www.investopedia.com/terms/g/glide-path.asp",
    source: "Investopedia",
  },
  riskTolerance: {
    title: "Risk tolerance",
    body: "How much volatility and potential loss you're willing to accept in pursuit of returns — often reduced as goals get closer.",
    href: "https://www.investopedia.com/terms/r/risktolerance.asp",
    source: "Investopedia",
  },
  macroShock: {
    title: "Macro / geopolitical shock",
    body: "A sudden market crash (recession, crisis, war, oil shock) modeled as a jump: an instantaneous drop plus elevated turbulence while markets recover.",
    href: "https://en.wikipedia.org/wiki/Jump_diffusion",
    source: "Wikipedia",
  },
  reverseStress: {
    title: "Reverse stress testing",
    body: "Start from a defined failure and work backwards to find the scenario that causes it — the mirror image of a forward simulation.",
    href: "https://www.investopedia.com/terms/s/stresstesting.asp",
    source: "Investopedia",
  },
  sensitivity: {
    title: "Sensitivity analysis",
    body: "Varying one input at a time to see which assumptions move the outcome most. The tornado chart ranks them by impact.",
    href: "https://www.investopedia.com/terms/s/sensitivityanalysis.asp",
    source: "Investopedia",
  },
  sequenceRisk: {
    title: "Sequence-of-returns risk",
    body: "The danger that poor returns early in retirement — while you're withdrawing — do lasting damage even if the average return is fine.",
    href: "https://www.investopedia.com/terms/s/sequence-risk.asp",
    source: "Investopedia",
  },

  // --- Output statistics ---
  median: {
    title: "Median outcome",
    body: "The middle result: half of all simulated paths end above it and half below. Less skewed by extremes than the mean.",
    href: "https://www.investopedia.com/terms/m/median.asp",
    source: "Investopedia",
  },
  mean: {
    title: "Mean outcome",
    body: "The simple average of all path outcomes. For skewed (log-normal) results it sits above the median.",
    href: "https://www.investopedia.com/terms/m/mean.asp",
    source: "Investopedia",
  },
  percentile: {
    title: "Percentiles (P5 / P95)",
    body: "P5 is the value only 5% of paths fall below (a bad case); P95 is the value only 5% exceed (a good case). Together they bound the likely range.",
    href: "https://www.investopedia.com/terms/p/percentile.asp",
    source: "Investopedia",
  },
  var95: {
    title: "95% Value at Risk (VaR)",
    body: "An estimate of the loss versus your starting amount at the 5th percentile — a 'this-bad-or-worse happens ~5% of the time' figure.",
    href: "https://www.investopedia.com/terms/v/var.asp",
    source: "Investopedia",
  },
  probLoss: {
    title: "Probability of loss",
    body: "The share of simulated paths that finish below the amount you started with.",
    href: "https://www.investopedia.com/terms/d/downsiderisk.asp",
    source: "Investopedia",
  },
  successRate: {
    title: "Success rate",
    body: "The share of simulated retirements that never run out of money before the end of the horizon.",
    href: "https://www.investopedia.com/terms/m/montecarlosimulation.asp",
    source: "Investopedia",
  },
  drawdown: {
    title: "Drawdown",
    body: "A peak-to-trough drop in value, expressed as a percentage. Reverse stress uses a target drawdown as the defined 'failure'.",
    href: "https://www.investopedia.com/terms/d/drawdown.asp",
    source: "Investopedia",
  },
  zscore: {
    title: "Z-score",
    body: "How many standard deviations an outcome sits from the mean. Bigger magnitude means a rarer, more extreme scenario.",
    href: "https://www.investopedia.com/terms/z/zscore.asp",
    source: "Investopedia",
  },
  requiredReturn: {
    title: "Required return",
    body: "The constant annual return the plan would need to exactly last the whole horizon. Compare it to what you're assuming.",
    href: "https://www.investopedia.com/terms/r/requiredrateofreturn.asp",
    source: "Investopedia",
  },
  targetValue: {
    title: "Target (failure) value",
    body: "The ending balance that counts as the failure you're stress-testing — your starting amount less the chosen drawdown. The analysis solves for the path that lands exactly here.",
    href: "https://www.investopedia.com/terms/d/drawdown.asp",
    source: "Investopedia",
  },
  totalReturn: {
    title: "Total return",
    body: "The cumulative percentage change over the whole horizon (not annualized) — the required annual return compounded across every year.",
    href: "https://www.investopedia.com/terms/t/totalreturn.asp",
    source: "Investopedia",
  },
  likelihood: {
    title: "Likelihood (1-in-N)",
    body: "The model-implied odds of the failure scenario, restated as a '1 in N' frequency. A larger N means a rarer, more extreme event under your μ/σ assumptions.",
    href: "https://www.investopedia.com/terms/p/probabilitydistribution.asp",
    source: "Investopedia",
  },
  maxWithdrawal: {
    title: "Maximum sustainable withdrawal",
    body: "The largest first-year withdrawal (grown with inflation thereafter) that your assumed return can support without running out of money before the horizon ends.",
    href: "https://www.investopedia.com/terms/f/four-percent-rule.asp",
    source: "Investopedia",
  },
  maxCrash: {
    title: "Maximum absorbable crash",
    body: "The biggest one-time market drop, striking on the first day of retirement, that the plan can still survive to the end of the horizon — a measure of sequence-of-returns resilience.",
    href: "https://www.investopedia.com/terms/s/sequence-risk.asp",
    source: "Investopedia",
  },
  shockFrequency: {
    title: "Shock frequency",
    body: "How often crashes strike across the simulation — the share of paths hit by at least one shock, and the average number of shocks per path, given the annual shock probability.",
    href: "https://en.wikipedia.org/wiki/Poisson_distribution",
    source: "Wikipedia",
  },
  worstCase: {
    title: "Worst case",
    body: "The single lowest ending value across all simulated paths — the most extreme outcome the run produced. It's a sample minimum, so it shifts with the number of simulations.",
    href: "https://www.investopedia.com/terms/t/tailrisk.asp",
    source: "Investopedia",
  },
  deltaVsBase: {
    title: "Change vs. baseline",
    body: "How far each scenario's median ending value falls below the no-shock baseline, as a percentage — the headline damage the scenario does.",
    href: "https://www.investopedia.com/terms/s/stresstesting.asp",
    source: "Investopedia",
  },
};

export type GlossaryKey = keyof typeof GLOSSARY;
