import { createPuzzleService, type Bundle, type Transport } from './puzzle-service';
import { createWorkerTransport } from './worker-transport';
import type { Difficulty, PuzzleType } from '../engine/core/types';

export interface GeneratedInstance {
  instance: string;
  solution: string;
  achievedDifficulty: Difficulty;
  source: 'live' | 'baked';
}

/**
 * Shared puzzle-load path for the play/daily routes: fetch the fallback bundle, spin up a
 * fresh worker transport, and request one instance. `onTransport` hands the caller the
 * transport synchronously (before the network await) so it can dispose/cancel an in-flight
 * generation when the component unmounts.
 */
export async function generateInstance(
  type: PuzzleType,
  difficulty: Difficulty,
  seed: string,
  opts: { timeoutMs: number; onTransport?: (t: Transport) => void }
): Promise<GeneratedInstance> {
  let bundle: Bundle | null;
  try {
    bundle = await (await fetch('/puzzles.bundle.json')).json();
  } catch {
    bundle = null;
  }
  const transport = createWorkerTransport();
  opts.onTransport?.(transport);
  const svc = createPuzzleService(transport, { timeoutMs: opts.timeoutMs, bundle });
  return svc.request(type, difficulty, seed);
}
