import YoctoQueue from 'yocto-queue';
import Md5ChunksWorker from './md5ChunksWorker.ts?worker';

export enum Md5ChunksWorkerLabelsEnum {
  INIT = 'INIT',
  ERROR = 'ERROR',
}
export enum Md5ChunksChannelLabelsEnum {
  DOING = 'DOING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}
/**
 * Generates hash values for each file chunk.
 * @param blobArr - An array containing multiple Blobs.
 * @returns Promise<string[]> - A Promise that resolves to an array of hash values for each Blob.
 */
export function generateChunksHash(blobArr: Blob[]): Promise<string[]> {
  if (blobArr.length === 0) {
    return Promise.resolve([]);
  }

  const workerCount = getWorkerCount(blobArr.length);
  const queue = new YoctoQueue<{ blob: Blob; index: number }>();
  const results: string[] = [];
  const workers: { worker: Worker; channel: MessageChannel }[] = [];
  let completedCount = 0;
  let settled = false;
  blobArr.forEach((blob, index) => {
    queue.enqueue({ blob, index });
  });
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      workers.forEach(({ worker, channel }) => {
        worker.terminate();
        channel.port1.close();
        channel.port2.close();
      });
    };

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(results);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    for (let i = 0; i < workerCount; i++) {
      const worker = new Md5ChunksWorker();
      const channel = new MessageChannel();
      workers.push({
        worker,
        channel,
      });
      channel.port2.onmessage = (event: MessageEvent) => {
        const {
          label,
          data,
          index,
        }: { label: Md5ChunksChannelLabelsEnum; data: string; index: number } = event.data;

        switch (label) {
          case Md5ChunksChannelLabelsEnum.DONE:
            {
              results[index] = data;
              completedCount++;
              if (completedCount === blobArr.length) {
                resolveOnce();
                return;
              }
              const blob = queue.dequeue();
              if (blob)
                channel.port2.postMessage({
                  data: blob,
                  label: Md5ChunksChannelLabelsEnum.DOING,
                });
            }

            break;
          case Md5ChunksChannelLabelsEnum.ERROR:
            rejectOnce(new Error(`Worker ${index} reported error: ${data}`));
            break;
          default:
        }
      };
      worker.postMessage({ label: Md5ChunksWorkerLabelsEnum.INIT, port: channel.port1 }, [
        channel.port1,
      ]);
      const initialBlob = queue.dequeue();
      if (initialBlob) {
        channel.port2.postMessage({
          data: initialBlob,
          label: Md5ChunksChannelLabelsEnum.DOING,
        });
      }
    }
  });
}

function getWorkerCount(chunkCount: number): number {
  const hardwareConcurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  const defaultWorkerCount =
    typeof hardwareConcurrency === 'number' && hardwareConcurrency >= 2
      ? Math.floor(hardwareConcurrency / 2)
      : 4;

  return Math.max(1, Math.min(chunkCount, defaultWorkerCount));
}
