/**
 * Seedable pseudo-random number generator with a normal (Gaussian) sampler.
 *
 * The original Python models use `numpy.random.default_rng` (PCG64). We can't
 * bit-match NumPy's stream in JavaScript, but we provide the same *contract*:
 * a `seed` gives fully reproducible runs, and the sampled values are drawn from
 * the correct distributions. Uniforms come from a mulberry32 generator and are
 * converted to standard normals via the Box-Muller transform.
 */

export class Rng {
  private state: number;
  private spare: number | null = null;

  constructor(seed?: number | null) {
    // A `null`/`undefined` seed means "non-reproducible": pick a random seed.
    const s =
      seed === undefined || seed === null
        ? Math.floor(Math.random() * 0xffffffff)
        : seed >>> 0;
    // Avoid a degenerate all-zero state.
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  /** Uniform in [0, 1). */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal N(0, 1) via Box-Muller (with a cached spare value). */
  standardNormal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u1 = 0;
    let u2 = 0;
    // Guard against log(0).
    while (u1 <= Number.EPSILON) u1 = this.next();
    u2 = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    this.spare = mag * Math.sin(2.0 * Math.PI * u2);
    return mag * Math.cos(2.0 * Math.PI * u2);
  }

  /** Normal with given mean and standard deviation. */
  normal(mean: number, std: number): number {
    return mean + std * this.standardNormal();
  }

  /** Gamma(shape, scale=1) via Marsaglia & Tsang's method. */
  gamma(shape: number): number {
    if (shape < 1) {
      // Boost a sub-1 shape: Gamma(a) = Gamma(a+1) * U^(1/a).
      const u = Math.max(this.next(), Number.EPSILON);
      return this.gamma(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    // Bounded loop; acceptance probability is high, but cap iterations anyway.
    for (let i = 0; i < 1000; i++) {
      let x: number;
      let v: number;
      do {
        x = this.standardNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.next();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
    return d; // fallback (essentially never reached)
  }

  /**
   * Standard Student-t with `nu` degrees of freedom, scaled to UNIT variance
   * (for nu > 2) so it can drop into a model in place of a standard normal
   * without changing the target volatility — it only fattens the tails.
   *
   *   t = Z / sqrt(chi2_nu / nu),   chi2_nu = 2 * Gamma(nu/2)
   */
  standardT(nu: number): number {
    const df = Math.max(2.1, nu); // keep variance finite (needs nu > 2)
    const z = this.standardNormal();
    const chi2 = 2 * this.gamma(df / 2);
    const t = z / Math.sqrt(chi2 / df);
    return t * Math.sqrt((df - 2) / df); // rescale to unit variance
  }
}
