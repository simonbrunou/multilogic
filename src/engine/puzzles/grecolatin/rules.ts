import type { GrecoLatinInstance } from './types';

export const VALID_ORDERS = [3, 4, 5, 7, 8, 9];

export function encodePair(a: number, b: number, n: number): number {
  return a * n + b + 1;
}
export function decodePair(v: number, n: number): { a: number; b: number } | null {
  if (v === 0) return null;
  const c = v - 1;
  return { a: Math.floor(c / n), b: c % n };
}

export interface ValidationResult {
  complete: boolean;
  valid: boolean;
  score: number;
  conflicts: Set<number>;
}

/** Validate a (possibly partial) grid: rows & cols Latin in both projections + globally distinct pairs. */
export function validateGrid(n: number, cells: number[]): ValidationResult {
  const total = n * n;
  const conflicts = new Set<number>();
  const A = new Array<number>(total).fill(-1);
  const B = new Array<number>(total).fill(-1);
  let filled = 0;
  for (let i = 0; i < total; i++) {
    if (cells[i] !== 0) {
      filled++;
      const p = decodePair(cells[i], n)!;
      A[i] = p.a;
      B[i] = p.b;
    }
  }
  const flagDups = (idxs: number[]) => {
    for (const proj of [A, B]) {
      const seen = new Map<number, number[]>();
      for (const i of idxs) {
        if (proj[i] < 0) continue;
        const g = seen.get(proj[i]);
        if (g) g.push(i); else seen.set(proj[i], [i]);
      }
      for (const g of seen.values()) if (g.length > 1) for (const i of g) conflicts.add(i);
    }
  };
  for (let r = 0; r < n; r++) flagDups(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) flagDups(Array.from({ length: n }, (_, r) => r * n + c));
  // global pair distinctness
  const pairSeen = new Map<number, number[]>();
  for (let i = 0; i < total; i++) {
    if (cells[i] === 0) continue;
    const g = pairSeen.get(cells[i]);
    if (g) g.push(i); else pairSeen.set(cells[i], [i]);
  }
  for (const g of pairSeen.values()) if (g.length > 1) for (const i of g) conflicts.add(i);

  return { complete: filled === total, valid: conflicts.size === 0, score: filled / total, conflicts };
}

export function serializeInstance(inst: GrecoLatinInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): GrecoLatinInstance { return JSON.parse(s) as GrecoLatinInstance; }
export function serializeSolution(): string { return ''; }      // construction: no solution payload
export function deserializeSolution(): null { return null; }
