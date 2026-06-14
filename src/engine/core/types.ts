import type { PRNG } from './prng';

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(s: string): s is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(s);
}

export type PuzzleType = 'sudoku' | 'tectonic' | 'kakuro' | 'grecolatin';

/** Engine-internal generate() args. `signal` is created worker-side (never serialised). */
export interface GenArgs {
  difficulty: Difficulty;
  prng: PRNG;
  signal: AbortSignal;
}

/** Drives the worker fallback chain: compare requested vs achieved difficulty, know the source. */
export interface GenResult<Instance, Solution> {
  instance: Instance;
  solution: Solution | null; // null for construction puzzles
  achievedDifficulty: Difficulty;
  source: 'live' | 'baked';
}

/** Result of a complete-solve / uniqueness check. */
export interface SolveResult<Solution> {
  /** Number of solutions found, capped at the requested limit. */
  count: number;
  /** The first solution found, if any. */
  solution: Solution | null;
}

export interface PuzzleBase<Instance, State, Move> {
  type: PuzzleType;
  generate(args: GenArgs): Promise<GenResult<Instance, unknown>>;
  validateMove(instance: Instance, state: State, move: Move): MoveResult;
  getHint?(instance: Instance, state: State): Hint | null;
  render(instance: Instance, state: State): RenderModel;
}

export interface DeductionPuzzle<Instance, State, Move, Solution>
  extends PuzzleBase<Instance, State, Move> {
  kind: 'deduction';
  solveComplete(instance: Instance, limit?: number): SolveResult<Solution>;
  rate(instance: Instance): Difficulty;
}

export interface ConstructionPuzzle<Instance, State, Move>
  extends PuzzleBase<Instance, State, Move> {
  kind: 'construction';
  validate(instance: Instance, state: State): ConstructionResult;
}

export type PuzzleModule =
  | DeductionPuzzle<any, any, any, any>
  | ConstructionPuzzle<any, any, any>;

// Named placeholder types — shaped per puzzle as each arm is implemented.
export interface MoveResult { ok: boolean; reason?: string }
export interface Hint { cells: number[]; text: string }
export interface RenderModel { kind: string; [k: string]: unknown }
export interface ConstructionResult { complete: boolean; valid: boolean; score: number }
