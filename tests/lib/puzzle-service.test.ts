import { describe, it, expect } from 'vitest';
import { createPuzzleService, type Transport, type Bundle } from '../../src/lib/puzzle-service';
import type { WorkerRequest, WorkerResponse } from '../../src/worker/protocol';

function fakeTransport(behaviour: (req: WorkerRequest, reply: (r: WorkerResponse) => void) => void): Transport {
  let handler: (r: WorkerResponse) => void = () => {};
  return {
    post: (req) => behaviour(req, (r) => handler(r)),
    onMessage: (h) => { handler = h; }
  };
}

const BUNDLE: Bundle = {
  engineVersion: 1,
  puzzles: [
    { type: 'sudoku', requested: 'easy', achieved: 'easy', givens: 'g-easy', solution: 's-easy' },
    { type: 'sudoku', requested: 'hard', achieved: 'medium', givens: 'g-hard', solution: 's-hard' }
  ]
};

describe('puzzle service', () => {
  it('resolves with a live result when the worker replies', async () => {
    const t = fakeTransport((req, reply) => {
      const generateReq = req as Extract<WorkerRequest, { kind: 'generate' }>;
      reply({ kind: 'result', id: generateReq.id, givens: 'G', solution: 'S', achievedDifficulty: 'easy' });
    });
    const svc = createPuzzleService(t, { timeoutMs: 1000 });
    const res = await svc.request('sudoku', 'easy', 'seed1');
    expect(res.source).toBe('live');
    expect(res.givens).toBe('G');
  });

  it('falls back to the baked bundle on timeout', async () => {
    const t = fakeTransport(() => {});
    const svc = createPuzzleService(t, { timeoutMs: 10, bundle: BUNDLE });
    const res = await svc.request('sudoku', 'easy', 'seed1');
    expect(res.source).toBe('baked');
    expect(res.givens).toBe('g-easy');
  });

  it('falls back to the closest baked difficulty when exact is missing', async () => {
    const t = fakeTransport(() => {});
    const svc = createPuzzleService(t, { timeoutMs: 10, bundle: BUNDLE });
    const res = await svc.request('sudoku', 'expert', 'seed1');
    expect(res.source).toBe('baked');
    expect(res.givens).toBe('g-hard');
  });

  it('rejects on timeout when no bundle is available', async () => {
    const t = fakeTransport(() => {});
    const svc = createPuzzleService(t, { timeoutMs: 10, bundle: null });
    await expect(svc.request('sudoku', 'easy', 'seed1')).rejects.toThrow();
  });

  it('falls back on a worker error response', async () => {
    const t = fakeTransport((req, reply) => {
      const generateReq = req as Extract<WorkerRequest, { kind: 'generate' }>;
      reply({ kind: 'error', id: generateReq.id, message: 'boom' });
    });
    const svc = createPuzzleService(t, { timeoutMs: 1000, bundle: BUNDLE });
    const res = await svc.request('sudoku', 'easy', 'seed1');
    expect(res.source).toBe('baked');
  });
});
