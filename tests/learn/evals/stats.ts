/**
 * The statistics the cross-model evals report: Wilson intervals on pass rates, pass^k, a paired
 * cluster bootstrap on an arm difference, and Cohen's κ between raters. Pure and seeded, so a
 * rerun on the same records prints the same numbers. Not a test file.
 */

export interface Interval {
  estimate: number;
  lo: number;
  hi: number;
}

/** Wilson score interval for `passes` of `n`. z = 1.96 is 95%. An empty sample is [0, 1]. */
export function wilson(passes: number, n: number, z = 1.96): Interval {
  if (n === 0) return { estimate: 0, lo: 0, hi: 1 };
  const p = passes / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { estimate: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export interface Run {
  case: string;
  pass: boolean;
}

export interface CaseRate {
  case: string;
  n: number;
  passes: number;
  rate: Interval;
}

/** Pass rate per case, in first-seen order, each with its Wilson interval. */
export function perCase(runs: readonly Run[]): CaseRate[] {
  const byCase = new Map<string, { n: number; passes: number }>();
  for (const r of runs) {
    const row = byCase.get(r.case) ?? { n: 0, passes: 0 };
    row.n += 1;
    row.passes += r.pass ? 1 : 0;
    byCase.set(r.case, row);
  }
  return [...byCase].map(([id, { n, passes }]) => ({ case: id, n, passes, rate: wilson(passes, n) }));
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1);
  return out;
}

/**
 * pass^k: the chance that k independent runs of a case all pass, averaged over cases. Per case it
 * is C(c, k) / C(n, k) for c passes in n runs, the unbiased estimate, which is the plain
 * "all k passed" when n = k. A case with fewer than k runs is left out.
 */
export function passHatK(runs: readonly Run[], k: number): number {
  const rows = perCase(runs).filter((r) => r.n >= k);
  if (rows.length === 0 || k < 1) return 0;
  return rows.reduce((sum, r) => sum + choose(r.passes, k) / choose(r.n, k), 0) / rows.length;
}

/** mulberry32: small, fast, and the same sequence for the same seed on every platform. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One case's runs under both arms. Scores are 0/1 for pass/fail or any number for a graded score. */
export interface PairedCase {
  case: string;
  a: number[];
  b: number[];
}

export interface BootstrapResult extends Interval {
  /** Cases that had at least one run in each arm; the rest carry no paired evidence. */
  clusters: number;
  iterations: number;
  seed: number;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Mean of per-case (arm A − arm B) with a percentile interval from a paired cluster bootstrap:
 * cases are resampled with replacement and each keeps all its runs in both arms, so runs of one
 * case are never treated as independent evidence.
 */
export function pairedBootstrap(
  cases: readonly PairedCase[],
  options: { iterations?: number; seed?: number; level?: number } = {},
): BootstrapResult {
  const iterations = options.iterations ?? 10_000;
  const seed = options.seed ?? 1;
  const level = options.level ?? 0.95;
  const diffs = cases.filter((c) => c.a.length > 0 && c.b.length > 0).map((c) => mean(c.a) - mean(c.b));
  if (diffs.length === 0) return { estimate: 0, lo: 0, hi: 0, clusters: 0, iterations, seed };
  const next = rng(seed);
  const stats: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < diffs.length; j++) sum += diffs[Math.floor(next() * diffs.length)]!;
    stats[i] = sum / diffs.length;
  }
  stats.sort((x, y) => x - y);
  const at = (q: number) => stats[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))]!;
  const tail = (1 - level) / 2;
  return { estimate: mean(diffs), lo: at(tail), hi: at(1 - tail), clusters: diffs.length, iterations, seed };
}

/**
 * Cohen's κ for two raters over the same items. Null when it is undefined: no items, or both
 * raters gave every item the same single label, so chance agreement is already total.
 */
export function cohenKappa(a: readonly string[], b: readonly string[]): number | null {
  if (a.length !== b.length) throw new Error(`cohenKappa: ${a.length} ratings against ${b.length}`);
  const n = a.length;
  if (n === 0) return null;
  let agree = 0;
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    countA.set(a[i]!, (countA.get(a[i]!) ?? 0) + 1);
    countB.set(b[i]!, (countB.get(b[i]!) ?? 0) + 1);
  }
  const observed = agree / n;
  let chance = 0;
  for (const [label, count] of countA) chance += (count / n) * ((countB.get(label) ?? 0) / n);
  if (chance === 1) return null;
  return (observed - chance) / (1 - chance);
}

export interface KappaRow {
  a: string;
  b: string;
  /** Items both raters labelled. */
  n: number;
  kappa: number | null;
}

/** κ for every pair of raters, over the items each pair both labelled. `ratings[rater][item] = label`. */
export function kappaTable(ratings: Readonly<Record<string, Readonly<Record<string, string>>>>): KappaRow[] {
  const raters = Object.keys(ratings).sort();
  const rows: KappaRow[] = [];
  for (let i = 0; i < raters.length; i++) {
    for (let j = i + 1; j < raters.length; j++) {
      const ra = ratings[raters[i]!]!;
      const rb = ratings[raters[j]!]!;
      const items = Object.keys(ra)
        .filter((item) => item in rb)
        .sort();
      rows.push({
        a: raters[i]!,
        b: raters[j]!,
        n: items.length,
        kappa: cohenKappa(
          items.map((x) => ra[x]!),
          items.map((x) => rb[x]!),
        ),
      });
    }
  }
  return rows;
}
