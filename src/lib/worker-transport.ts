import type { Transport } from './puzzle-service';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';
import GenerateWorker from '../worker/generate.worker?worker';

/** Wrap a real Web Worker as a Transport. Browser-only. */
export function createWorkerTransport(): Transport {
  const worker = new GenerateWorker() as Worker;
  return {
    post: (req: WorkerRequest) => worker.postMessage(req),
    onMessage: (handler: (res: WorkerResponse) => void) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => handler(e.data);
    },
    onError: (handler: () => void) => {
      // Fires when the worker script can't load/run (e.g. offline before its chunk was cached).
      worker.onerror = () => handler();
    },
    dispose: () => worker.terminate()
  };
}
