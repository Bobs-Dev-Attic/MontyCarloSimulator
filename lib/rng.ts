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
}
