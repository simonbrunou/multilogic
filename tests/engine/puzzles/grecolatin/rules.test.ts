import { describe, it, expect } from 'vitest';
import { encodePair, decodePair, validateGrid, VALID_ORDERS, serializeInstance, deserializeInstance } from '../../../../src/engine/puzzles/grecolatin/rules';

describe('grecolatin rules', () => {
  it('valid orders exclude 2 and 6', () => {
    expect(VALID_ORDERS).toEqual([3, 4, 5, 7, 8, 9]);
  });
  it('encode/decode pairs round-trip (1-based, 0 = empty)', () => {
    expect(encodePair(0, 0, 3)).toBe(1);
    expect(encodePair(2, 1, 3)).toBe(8); // 2*3+1+1
    expect(decodePair(8, 3)).toEqual({ a: 2, b: 1 });
    expect(decodePair(0, 3)).toBeNull();
  });
  it('validateGrid: a valid complete order-3 square scores 1 and is valid', () => {
    // direct construction n=3: a=(i+j)%3, b=(i+2j)%3
    const n = 3;
    const cells: number[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push(encodePair((i + j) % n, (i + 2 * j) % n, n));
    const r = validateGrid(n, cells);
    expect(r.complete).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(1);
    expect(r.conflicts.size).toBe(0);
  });
  it('validateGrid: a row with a repeated symbol flags a conflict', () => {
    const n = 3;
    const cells = new Array(9).fill(0);
    cells[0] = encodePair(0, 0, n); // (0,0)
    cells[1] = encodePair(0, 1, n); // (0,1) — same a=0 in row 0 → a-projection conflict
    const r = validateGrid(n, cells);
    expect(r.valid).toBe(false);
    expect(r.conflicts.has(0)).toBe(true);
    expect(r.conflicts.has(1)).toBe(true);
    expect(r.complete).toBe(false);
  });
  it('validateGrid: duplicate pair flags a conflict', () => {
    const n = 3;
    const cells = new Array(9).fill(0);
    cells[0] = encodePair(0, 0, n);
    cells[8] = encodePair(0, 0, n); // same pair elsewhere (not same row/col) → pair-distinctness conflict
    const r = validateGrid(n, cells);
    expect(r.valid).toBe(false);
    expect(r.conflicts.has(0)).toBe(true);
    expect(r.conflicts.has(8)).toBe(true);
  });
  it('serialize/deserialize round-trips', () => {
    const inst = { n: 5, digitClues: new Array(25).fill(null), letterClues: new Array(25).fill(null) };
    expect(deserializeInstance(serializeInstance(inst))).toEqual(inst);
  });
});
