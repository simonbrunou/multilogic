/// <reference lib="webworker" />
import { sudoku } from '../engine/puzzles/sudoku/index';
import { createPrng } from '../engine/core/prng';
import { gridToString } from '../engine/puzzles/sudoku/rules';
import type { WorkerRequest, WorkerResponse } from './protocol';

const controllers = new Map<number, AbortController>();

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.kind === 'cancel') {
    controllers.get(req.id)?.abort();
    controllers.delete(req.id);
    return;
  }
  if (req.kind === 'generate') {
    const ctrl = new AbortController();
    controllers.set(req.id, ctrl);
    try {
      const res = await sudoku.generate({ difficulty: req.difficulty, prng: createPrng(req.seed), signal: ctrl.signal });
      const msg: WorkerResponse = {
        kind: 'result',
        id: req.id,
        givens: gridToString(res.instance.givens),
        solution: gridToString(res.solution!),
        achievedDifficulty: res.achievedDifficulty
      };
      (self as unknown as Worker).postMessage(msg);
    } catch (err) {
      const msg: WorkerResponse = { kind: 'error', id: req.id, message: err instanceof Error ? err.message : 'generation failed' };
      (self as unknown as Worker).postMessage(msg);
    } finally {
      controllers.delete(req.id);
    }
  }
};
