import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, isDifficulty } from '../../../src/engine/core/types';

describe('core types', () => {
  it('exposes the difficulty band order', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard', 'expert']);
  });

  it('isDifficulty narrows valid strings', () => {
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('impossible')).toBe(false);
  });
});
