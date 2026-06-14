/** Seedable, runtime-agnostic PRNG. Inject this everywhere the engine needs randomness. */
export interface PRNG {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(arr: T[]): T[];
  /** Random element of a non-empty array. */
  pick<T>(arr: T[]): T;
}

/** xmur3 string hash → 32-bit seed generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32: fast 32-bit PRNG. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Create a PRNG from a string or numeric seed. */
export function createPrng(seed: string | number): PRNG {
  const seedStr = typeof seed === 'number' ? `n:${seed}` : seed;
  const h = xmur3(seedStr);
  const next = sfc32(h(), h(), h(), h());
  return {
    next,
    int(n: number) {
      if (n <= 0) throw new RangeError(`int(n) requires n > 0, got ${n}`);
      return Math.floor(next() * n);
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    pick<T>(arr: T[]): T {
      if (arr.length === 0) throw new RangeError('pick() requires a non-empty array');
      return arr[Math.floor(next() * arr.length)];
    }
  };
}

/** Deterministic seed derivation, used by daily puzzles and tests. */
export function deriveSeed(...parts: (string | number)[]): string {
  return parts.map(String).join('|');
}
