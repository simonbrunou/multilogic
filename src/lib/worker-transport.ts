import type { Transport } from './puzzle-service';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';
// @ts-expect-error - Vite worker import
import SudokuWorker from '../worker/sudoku.worker?worker';

/** Wrap a real Web Worker as a Transport. Browser-only. */
export function createWorkerTransport(): Transport {
  const worker = new SudokuWorker() as Worker;
  return {
    post: (req: WorkerRequest) => worker.postMessage(req),
    onMessage: (handler: (res: WorkerResponse) => void) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => handler(e.data);
    }
  };
}
