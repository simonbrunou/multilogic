import { encodePair, decodePair } from './rules';
import { rate } from './rater';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';
import type { GrecoLatinInstance } from './types';

// ---------------------------------------------------------------------------
// GF(2^k) arithmetic helpers (used for even orders n=4 and n=8)
// ---------------------------------------------------------------------------

/** Multiply two elements in GF(2^k) given the primitive polynomial and its degree. */
function gfMul(a: number, b: number, poly: number, deg: number): number {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    a <<= 1;
    if (a & (1 << deg)) a ^= poly;
    b >>= 1;
  }
  return result;
}

/**
 * Build a Greco-Latin square of order n = 2^k using the GF(2^k) construction.
 * For row i, column j: a[i][j] = alpha*i + j, b[i][j] = beta*i + j (all in GF(n)).
 * alpha=2, beta=3 are distinct non-zero elements with alpha XOR beta = 1 ≠ 0,
 * which guarantees GL validity for all n = 2^k (k >= 2).
 * Works for n=4 (GF(4), poly x^2+x+1=7) and n=8 (GF(8), poly x^3+x+1=11).
 */
function buildGFSquare(n: number, poly: number, deg: number): number[] {
  const cells = new Array<number>(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const av = gfMul(2, i, poly, deg) ^ j; // GF addition = XOR
      const bv = gfMul(3, i, poly, deg) ^ j;
      cells[i * n + j] = encodePair(av, bv, n);
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Odd-order direct cyclic construction
// a=(i+j)%n, b=(i+2j)%n  — valid since gcd(2,n)=1 for odd n
// ---------------------------------------------------------------------------
function buildOdd(n: number): number[] {
  const sol = new Array<number>(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      sol[i * n + j] = encodePair((i + j) % n, (i + 2 * j) % n, n);
  return sol;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Apply random row/col permutations + independent relabelling of both symbols.
 *  Preserves the GL property (valid for any GL square). */
function permute(sol: number[], n: number, prng: PRNG): number[] {
  const rowPerm = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const colPerm = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const aMap = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const bMap = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const out = new Array<number>(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const src = sol[rowPerm[i] * n + colPerm[j]];
      const p = decodePair(src, n)!;
      out[i * n + j] = encodePair(aMap[p.a], bMap[p.b], n);
    }
  }
  return out;
}

/**
 * Build a valid Greco-Latin square of order n, seeded for variety via permutations.
 * - Odd orders (3,5,7,9): direct cyclic construction (a=(i+j)%n, b=(i+2j)%n).
 * - n=4: GF(4) construction (poly x^2+x+1, elements 0..3, alpha=2, beta=3).
 * - n=8: GF(8) construction (poly x^3+x+1, elements 0..7, alpha=2, beta=3).
 * After construction, random row/col permutations + symbol relabelling are applied
 * so each seed yields a distinct puzzle variety.
 * Returns null only on invalid n (should not happen for VALID_ORDERS).
 */
export function buildSquare(n: number, prng: PRNG): number[] | null {
  let sol: number[];
  if (n % 2 === 1) {
    sol = buildOdd(n);
  } else if (n === 4) {
    // GF(4): irreducible polynomial x^2 + x + 1 = 0b111 = 7, degree 2
    sol = buildGFSquare(4, 7, 2);
  } else if (n === 8) {
    // GF(8): irreducible polynomial x^3 + x + 1 = 0b1011 = 11, degree 3
    sol = buildGFSquare(8, 11, 3);
  } else {
    return null; // order not supported
  }
  return permute(sol, n, prng);
}

// Per-band generation schedule seeded from the Phase-0 sweep (count = cells revealed,
// partial = fraction of reveals that expose only one dimension). Tuned in Task 6.
const SCHEDULE: Record<Difficulty, { count: number; partial: number }> = {
  easy: { count: 12, partial: 0.0 },
  medium: { count: 10, partial: 0.5 },
  hard: { count: 12, partial: 0.75 },
  expert: { count: 6, partial: 0.5 }
};
const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const GEN_ATTEMPTS = 80;

export interface GeneratedGreco {
  instance: GrecoLatinInstance;
  difficulty: Difficulty;
}

/** Reveal `count` random cells; each is full / digit-only / letter-only per `partial`. */
function revealPartial(
  sol: number[], n: number, count: number, partial: number, prng: PRNG
): { digitClues: (number | null)[]; letterClues: (number | null)[] } {
  const digitClues = new Array<number | null>(n * n).fill(null);
  const letterClues = new Array<number | null>(n * n).fill(null);
  const order = prng.shuffle(sol.map((_, i) => i));
  const k = Math.max(1, Math.min(count, n * n));
  for (let m = 0; m < k; m++) {
    const i = order[m];
    const p = decodePair(sol[i], n)!;
    if (prng.next() >= partial) { digitClues[i] = p.a; letterClues[i] = p.b; }      // full
    else if (prng.next() < 0.5) digitClues[i] = p.a;                                 // digit-only
    else letterClues[i] = p.b;                                                       // letter-only
  }
  return { digitClues, letterClues };
}

export function generateForDifficulty(prng: PRNG, target: Difficulty, n = 5): GeneratedGreco {
  const { count, partial } = SCHEDULE[target];
  let best: GeneratedGreco | null = null;
  for (let attempt = 0; attempt < GEN_ATTEMPTS; attempt++) {
    const sol = buildSquare(n, prng);
    if (!sol) throw new Error(`grecolatin: failed to build a square of order ${n}`);
    const { digitClues, letterClues } = revealPartial(sol, n, count, partial, prng);
    const instance: GrecoLatinInstance = { n, digitClues, letterClues };
    const difficulty = rate(instance);
    if (difficulty === target) return { instance, difficulty };
    if (best === null || Math.abs(RANK[difficulty] - RANK[target]) < Math.abs(RANK[best.difficulty] - RANK[target])) {
      best = { instance, difficulty };
    }
  }
  return best!;
}
