import type { Difficulty, PuzzleType } from '../engine/core/types';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

export interface Transport {
  post(req: WorkerRequest): void;
  onMessage(handler: (res: WorkerResponse) => void): void;
  /** Fatal transport failure (e.g. the worker script can't load — offline before it was cached). */
  onError?(handler: () => void): void;
  dispose?(): void;
}

export interface BakedPuzzle {
  type: string;
  requested: Difficulty;
  achieved: Difficulty;
  instance: string;
  solution: string;
}
export interface Bundle {
  engineVersion: number;
  puzzles: BakedPuzzle[];
}

interface PuzzleResult {
  instance: string;
  solution: string;
  achievedDifficulty: Difficulty;
  source: 'live' | 'baked';
}

export interface ServiceOpts {
  timeoutMs?: number;
  bundle?: Bundle | null;
}

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

/** Tiny deterministic string hash (engine-free, no Math.random — keeps SSR/replay stable). */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function pickFromBundle(
  bundle: Bundle | null | undefined,
  puzzle: PuzzleType,
  difficulty: Difficulty,
  seed: string
): PuzzleResult | null {
  if (!bundle) return null;
  const candidates = bundle.puzzles.filter((p) => p.type === puzzle);
  if (candidates.length === 0) return null;
  const dist = (p: BakedPuzzle) => Math.abs(RANK[p.achieved] - RANK[difficulty]);
  const best = candidates.reduce((b, p) => (dist(p) < dist(b) ? p : b), candidates[0]);
  const close = candidates.filter((p) => dist(p) === dist(best));
  const pick = close[hashSeed(seed) % close.length];
  return { instance: pick.instance, solution: pick.solution, achievedDifficulty: pick.achieved, source: 'baked' };
}

export function createPuzzleService(transport: Transport, opts: ServiceOpts = {}) {
  let nextId = 1;
  const pending = new Map<number, (res: WorkerResponse) => void>();
  transport.onMessage((res) => {
    const h = pending.get(res.id);
    if (h) h(res);
  });
  // If the worker itself fails (notably: an offline cold start where its chunk was never cached),
  // fail every in-flight request now so they fall back to the baked bundle immediately instead of
  // hanging until the per-request timeout.
  transport.onError?.(() => {
    for (const [id, h] of [...pending]) h({ kind: 'error', id, message: 'puzzle worker unavailable' });
  });

  function request(puzzle: PuzzleType, difficulty: Difficulty, seed: string): Promise<PuzzleResult> {
    const id = nextId++;
    const timeoutMs = opts.timeoutMs ?? 5000;
    return new Promise<PuzzleResult>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => { if (!settled) { settled = true; pending.delete(id); clearTimeout(timer); fn(); } };
      const fallbackOr = (rej: () => void) => {
        const fb = pickFromBundle(opts.bundle, puzzle, difficulty, seed);
        if (fb) resolve(fb); else rej();
      };
      const timer = setTimeout(() => {
        finish(() => {
          transport.post({ kind: 'cancel', id });
          fallbackOr(() => reject(new Error('generation timed out and no fallback bundle is available')));
        });
      }, timeoutMs);
      pending.set(id, (res) => {
        if (res.kind === 'result') {
          finish(() => resolve({ instance: res.instance, solution: res.solution, achievedDifficulty: res.achievedDifficulty, source: 'live' }));
        } else if (res.kind === 'error') {
          finish(() => fallbackOr(() => reject(new Error(res.message))));
        }
      });
      transport.post({ kind: 'generate', id, puzzle, difficulty, seed });
    });
  }

  return { request };
}
