import { describe, it, expect } from 'vitest';
import { generateRegions } from '../../../../src/engine/puzzles/tectonic/regions';
import { cellsByRegion } from '../../../../src/engine/puzzles/tectonic/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function contiguous(cells: number[], w: number, h: number): boolean {
  const set = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const q = [cells[0]];
  while (q.length) {
    const i = q.pop()!;
    const r = Math.floor(i / w), c = i % w;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr, nc = c + dc;
      const n = nr * w + nc;
      if (nr >= 0 && nr < h && nc >= 0 && nc < w && set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return seen.size === cells.length;
}

describe('generateRegions', () => {
  it('partitions every cell into a region', () => {
    const regions = generateRegions(5, 5, createPrng('r1'));
    expect(regions.length).toBe(25);
    expect(regions.every((r) => r >= 0)).toBe(true);
  });
  it('regions are contiguous and size <= 5', () => {
    const w = 6, h = 6;
    const regions = generateRegions(w, h, createPrng('r2'));
    for (const cells of Object.values(cellsByRegion(regions))) {
      expect(cells.length).toBeGreaterThanOrEqual(1);
      expect(cells.length).toBeLessThanOrEqual(5);
      expect(contiguous(cells, w, h)).toBe(true);
    }
  });
  it('is deterministic for a seed', () => {
    expect(generateRegions(5, 5, createPrng('same'))).toEqual(generateRegions(5, 5, createPrng('same')));
  });
});
