import { buildRunConstraints, type RunConstraint } from './rules';
import type { KakuroInstance } from './types';

export interface KakuroCtx {
  inst: KakuroInstance;
  grid: number[];
  cand: Set<number>[];
  runs: RunConstraint[];
  cellRuns: number[][];
}

/** Digits that can still appear in a run's EMPTY cells: union over all valid distinct-digit
 *  completions of the remaining sum (or, for an unclued run, any unused digit). */
export function runPossibleDigits(run: RunConstraint, grid: number[]): Set<number> {
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  const avail: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) avail.push(d);
  if (run.target === null) return new Set<number>(avail);
  const remTarget = run.target - placed.reduce((s, v) => s + v, 0);
  const emptyCount = run.cells.filter((c) => grid[c] === 0).length;
  const union = new Set<number>();
  const rec = (start: number, count: number, sum: number, chosen: number[]): void => {
    if (count === 0) {
      if (sum === remTarget) for (const d of chosen) union.add(d);
      return;
    }
    for (let i = start; i < avail.length; i++) {
      if (sum + avail[i] > remTarget) break;
      chosen.push(avail[i]);
      rec(i + 1, count - 1, sum + avail[i], chosen);
      chosen.pop();
    }
  };
  rec(0, emptyCount, 0, []);
  return union;
}

/** Digits present in EVERY valid completion of a run (forced into the run). */
export function runForcedDigits(run: RunConstraint, grid: number[]): Set<number> {
  if (run.target === null) return new Set<number>();
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  const avail: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) avail.push(d);
  const remTarget = run.target - placed.reduce((s, v) => s + v, 0);
  const emptyCount = run.cells.filter((c) => grid[c] === 0).length;
  let inter: Set<number> | null = null;
  const rec = (start: number, count: number, sum: number, chosen: number[]): void => {
    if (count === 0) {
      if (sum !== remTarget) return;
      if (inter === null) inter = new Set<number>(chosen);
      else for (const d of [...inter]) if (!chosen.includes(d)) inter.delete(d);
      return;
    }
    for (let i = start; i < avail.length; i++) {
      if (sum + avail[i] > remTarget) break;
      chosen.push(avail[i]);
      rec(i + 1, count - 1, sum + avail[i], chosen);
      chosen.pop();
    }
  };
  rec(0, emptyCount, 0, []);
  return inter ?? new Set<number>();
}

/** Can digit `d` sit at empty cell `i` of `run` with the OTHER empty cells filled
 *  consistently (distinct, each in its candidate set, summing to the run target)? */
function digitFitsRun(run: RunConstraint, i: number, d: number, ctx: KakuroCtx): boolean {
  const { grid } = ctx;
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  if (used.has(d)) return false;
  if (run.target === null) return true;
  const others = run.cells.filter((c) => c !== i && grid[c] === 0);
  const target2 = run.target - placed.reduce((s, v) => s + v, 0) - d;
  const avail: number[] = [];
  for (let x = 1; x <= 9; x++) if (!used.has(x) && x !== d) avail.push(x);
  const assign = (k: number, sum: number, usedDigits: Set<number>): boolean => {
    if (k === others.length) return sum === target2;
    for (const x of avail) {
      if (usedDigits.has(x) || !ctx.cand[others[k]].has(x) || sum + x > target2) continue;
      usedDigits.add(x);
      if (assign(k + 1, sum + x, usedDigits)) return true;
      usedDigits.delete(x);
    }
    return false;
  };
  return assign(0, 0, new Set<number>([d]));
}

/** Intersect every empty cell's candidates with its runs' possible digits, to a fixpoint. */
function propagate(ctx: KakuroCtx): boolean {
  let changedAny = false;
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of ctx.runs) {
      const poss = runPossibleDigits(run, ctx.grid);
      for (const c of run.cells) {
        if (ctx.grid[c] !== 0) continue;
        for (const dd of [...ctx.cand[c]]) {
          if (!poss.has(dd)) {
            ctx.cand[c].delete(dd);
            changed = true;
            changedAny = true;
          }
        }
      }
    }
  }
  return changedAny;
}

function place(ctx: KakuroCtx, i: number, d: number): void {
  ctx.grid[i] = d;
  ctx.cand[i] = new Set<number>([d]);
}

/** Build a context with combination-restricted candidates for all white cells. */
export function makeCtx(inst: KakuroInstance): KakuroCtx {
  const { runs, cellRuns } = buildRunConstraints(inst);
  const grid = inst.black.map(() => 0);
  const cand = inst.black.map((b) => (b ? new Set<number>() : new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9])));
  const ctx: KakuroCtx = { inst, grid, cand, runs, cellRuns };
  propagate(ctx);
  return ctx;
}

export function isSolved(ctx: KakuroCtx): boolean {
  return ctx.inst.black.every((b, i) => b || ctx.grid[i] !== 0);
}

/** Rank 1: combination-propagate, then place any cell left with a single candidate. */
export function forcedCell(ctx: KakuroCtx): boolean {
  propagate(ctx);
  for (let i = 0; i < ctx.grid.length; i++) {
    if (!ctx.inst.black[i] && ctx.grid[i] === 0 && ctx.cand[i].size === 1) {
      place(ctx, i, [...ctx.cand[i]][0]);
      return true;
    }
  }
  return false;
}

/** Rank 2: a digit forced into every combo of a run, with exactly one empty cell able to hold it. */
export function forcedDigit(ctx: KakuroCtx): boolean {
  for (const run of ctx.runs) {
    for (const d of runForcedDigits(run, ctx.grid)) {
      const homes = run.cells.filter((c) => ctx.grid[c] === 0 && ctx.cand[c].has(d));
      if (homes.length === 1) {
        place(ctx, homes[0], d);
        return true;
      }
    }
  }
  return false;
}

/** Rank 3: eliminate a candidate digit that has no consistent completion in one of its runs. */
export function comboElimination(ctx: KakuroCtx): boolean {
  for (let i = 0; i < ctx.grid.length; i++) {
    if (ctx.inst.black[i] || ctx.grid[i] !== 0) continue;
    for (const d of [...ctx.cand[i]]) {
      for (const ri of ctx.cellRuns[i]) {
        if (!digitFitsRun(ctx.runs[ri], i, d, ctx)) {
          ctx.cand[i].delete(d);
          return true;
        }
      }
    }
  }
  return false;
}
