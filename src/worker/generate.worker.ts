/// <reference lib="webworker" />
import { getModule } from '../engine/puzzles/registry';
import { createPrng } from '../engine/core/prng';
import type { WorkerRequest, WorkerResponse } from './protocol';

const controllers = new Map<number, AbortController>();

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.kind === 'cancel') { controllers.get(req.id)?.abort(); controllers.delete(req.id); return; }
  const ctrl = new AbortController();
  controllers.set(req.id, ctrl);
  try {
    const mod = getModule(req.puzzle);
    const res = await mod.generate({ difficulty: req.difficulty, prng: createPrng(req.seed), signal: ctrl.signal });
    const msg: WorkerResponse = {
      kind: 'result',
      id: req.id,
      instance: mod.serializeInstance(res.instance),
      solution: res.solution !== null && res.solution !== undefined ? mod.serializeSolution(res.solution) : '',
      achievedDifficulty: res.achievedDifficulty
    };
    (self as unknown as Worker).postMessage(msg);
  } catch (err) {
    (self as unknown as Worker).postMessage({ kind: 'error', id: req.id, message: err instanceof Error ? err.message : 'generation failed' } as WorkerResponse);
  } finally {
    controllers.delete(req.id);
  }
};
