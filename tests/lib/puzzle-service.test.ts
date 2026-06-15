import { describe, it, expect } from 'vitest';
import { createPuzzleService, pickFromBundle, type Transport, type Bundle } from '../../src/lib/puzzle-service';
import type { WorkerRequest, WorkerResponse } from '../../src/worker/protocol';

function entry(achieved: string, requested: string, tag: string) {
  return { type: 'sudoku', requested, achieved, instance: tag, solution: tag } as Bundle['puzzles'][number];
}

const bundle: Bundle = {
  engineVersion: 1,
  puzzles: [
    entry('easy', 'easy', 'E'),
    entry('medium', 'medium', 'M'),
    entry('hard', 'hard', 'H1'),
    entry('hard', 'hard', 'H2'),
    entry('hard', 'hard', 'H3')
  ]
};

describe('pickFromBundle', () => {
  it('selects by ACHIEVED difficulty', () => {
    expect(pickFromBundle(bundle, 'sudoku', 'medium', 'seed-a')?.achievedDifficulty).toBe('medium');
  });

  it('falls back to the closest ACHIEVED band when the exact one is absent', () => {
    expect(pickFromBundle(bundle, 'sudoku', 'expert', 'seed-a')?.achievedDifficulty).toBe('hard');
  });

  it('varies among equally-close matches by seed', () => {
    const tags = new Set<string>();
    for (const seed of ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']) {
      tags.add(pickFromBundle(bundle, 'sudoku', 'hard', seed)!.instance);
    }
    expect(tags.size).toBeGreaterThan(1);
  });

  it('returns null when no puzzle of the type exists', () => {
    expect(pickFromBundle(bundle, 'kakuro', 'easy', 'seed-a')).toBeNull();
  });
});

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
    { type: 'sudoku', requested: 'easy', achieved: 'easy', instance: 'g-easy', solution: 's-easy' },
    { type: 'sudoku', requested: 'hard', achieved: 'medium', instance: 'g-hard', solution: 's-hard' }
  ]
};

describe('puzzle service', () => {
  it('resolves with a live result when the worker replies', async () => {
    const t = fakeTransport((req, reply) => {
      const generateReq = req as Extract<WorkerRequest, { kind: 'generate' }>;
      reply({ kind: 'result', id: generateReq.id, instance: 'G', solution: 'S', achievedDifficulty: 'easy' });
    });
    const svc = createPuzzleService(t, { timeoutMs: 1000 });
    const res = await svc.request('sudoku', 'easy', 'seed1');
    expect(res.source).toBe('live');
    expect(res.instance).toBe('G');
  });

  it('falls back to the baked bundle on timeout', async () => {
    const t = fakeTransport(() => {});
    const svc = createPuzzleService(t, { timeoutMs: 10, bundle: BUNDLE });
    const res = await svc.request('sudoku', 'easy', 'seed1');
    expect(res.source).toBe('baked');
    expect(res.instance).toBe('g-easy');
  });

  it('falls back to the closest baked difficulty when exact is missing', async () => {
    const t = fakeTransport(() => {});
    const svc = createPuzzleService(t, { timeoutMs: 10, bundle: BUNDLE });
    const res = await svc.request('sudoku', 'expert', 'seed1');
    expect(res.source).toBe('baked');
    expect(res.instance).toBe('g-hard');
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
