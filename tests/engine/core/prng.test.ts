import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createPrng } from '../../../src/engine/core/prng';

describe('createPrng', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = createPrng('seed-A');
    const b = createPrng('seed-A');
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds yield different sequences', () => {
    const a = createPrng('seed-A');
    const b = createPrng('seed-B');
    expect(a.next()).not.toEqual(b.next());
  });

  it('next() returns values in [0, 1)', () => {
    const r = createPrng('range');
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) returns an integer in [0, n)', () => {
    const r = createPrng('int');
    for (let i = 0; i < 1000; i++) {
      const v = r.int(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('shuffle is a permutation and is deterministic for a seed', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = createPrng('shuf').shuffle([...base]);
    const s2 = createPrng('shuf').shuffle([...base]);
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(base);
  });

  it('property: numeric seeds are also deterministic', () => {
    fc.assert(fc.property(fc.integer(), (seed) => {
      const x = createPrng(seed).next();
      const y = createPrng(seed).next();
      return x === y;
    }));
  });
});
