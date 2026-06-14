import { describe, it, expect } from 'vitest';
import { dailySeed, todayISO } from '../../src/lib/daily';
import { createPrng } from '../../src/engine/core/prng';

describe('daily', () => {
  it('todayISO formats a date as YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-06-14T09:00:00Z'))).toBe('2026-06-14');
  });

  it('dailySeed is stable for the same type+date', () => {
    expect(dailySeed('sudoku', '2026-06-14')).toBe(dailySeed('sudoku', '2026-06-14'));
  });

  it('dailySeed differs across dates and types', () => {
    expect(dailySeed('sudoku', '2026-06-14')).not.toBe(dailySeed('sudoku', '2026-06-15'));
    expect(dailySeed('sudoku', '2026-06-14')).not.toBe(dailySeed('kakuro', '2026-06-14'));
  });

  it('the seed drives a deterministic PRNG', () => {
    const a = createPrng(dailySeed('sudoku', '2026-06-14')).next();
    const b = createPrng(dailySeed('sudoku', '2026-06-14')).next();
    expect(a).toBe(b);
  });
});
