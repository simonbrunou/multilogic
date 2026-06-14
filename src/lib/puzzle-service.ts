import type { Difficulty, PuzzleType } from '../engine/core/types';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

export interface Transport {
  post(req: WorkerRequest): void;
  onMessage(handler: (res: WorkerResponse) => void): void;
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

export interface PuzzleResult {
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

function pickFromBundle(bundle: Bundle | null | undefined, puzzle: PuzzleType, difficulty: Difficulty): PuzzleResult | null {
  if (!bundle) return null;
  const candidates = bundle.puzzles.filter((p) => p.type === puzzle);
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const p of candidates) {
    if (Math.abs(RANK[p.requested] - RANK[difficulty]) < Math.abs(RANK[best.requested] - RANK[difficulty])) best = p;
  }
  return { instance: best.instance, solution: best.solution, achievedDifficulty: best.achieved, source: 'baked' };
}

export function createPuzzleService(transport: Transport, opts: ServiceOpts = {}) {
  let nextId = 1;
  const pending = new Map<number, (res: WorkerResponse) => void>();
  transport.onMessage((res) => {
    const h = pending.get(res.id);
    if (h) h(res);
  });

  function request(puzzle: PuzzleType, difficulty: Difficulty, seed: string): Promise<PuzzleResult> {
    const id = nextId++;
    const timeoutMs = opts.timeoutMs ?? 5000;
    return new Promise<PuzzleResult>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => { if (!settled) { settled = true; pending.delete(id); clearTimeout(timer); fn(); } };
      const fallbackOr = (rej: () => void) => {
        const fb = pickFromBundle(opts.bundle, puzzle, difficulty);
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
