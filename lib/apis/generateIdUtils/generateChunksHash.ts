import Md5ChunksWorker from './md5ChunksWorker.ts?worker&inline';
import YoctoQueue from 'yocto-queue';
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
  const workerCount = navigator?.hardwareConcurrency / 2 || 4;
  const queue = new YoctoQueue();
  const results: string[] = [];
  blobArr.forEach((blob, index) => {
    queue.enqueue({ blob, index });
  });
  return new Promise((resolve, reject) => {
    for (let i = 0; i < workerCount; i++) {
      const worker = new Md5ChunksWorker();
      const channel = new MessageChannel();
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
              if (results.length === blobArr.length) {
                resolve(results);
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
            reject(new Error(`Worker ${index} reported error: ${data}`));
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
