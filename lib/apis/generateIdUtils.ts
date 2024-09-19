import { currentFileChunks, FileChunkResult } from './currentFileChunks';
import { WorkerLabelsEnum } from './worker/worker.enum';

export interface FileHashResult {
  hash: string;
  chunkSize: number;
}
/**
 * Generates a id for the given file.
 *
 * @param {File} file - The file for which to generate the hash.
 * @param {number} [customChunkSize] - Optional custom size for file chunks.
 * @returns {Promise<FileHashResult>} - A promise that resolves to an object containing the id and chunk size.
 */
export function generateFileHash(file: File, customChunkSize?: number): Promise<FileHashResult> {
  return new Promise((resolve, reject) => {
    const { fileChunks, chunkSize }: FileChunkResult = currentFileChunks(file, customChunkSize);
    const workerCount = 4;
    const fileChunkSize = Math.ceil(fileChunks.length / workerCount);
    const workers: Worker[] = [];
    const partialHashes: string[] = [];
    let completedWorkers = 0;

    try {
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(new URL('./worker/md5.workers.ts', import.meta.url), {
          type: 'module',
        });
        workers.push(worker);
        worker.onmessage = (event: MessageEvent) => {
          const { label, data, index } = event.data;

          switch (label) {
            case WorkerLabelsEnum.DONE:
              partialHashes[index] = data;
              completedWorkers++;
              if (completedWorkers === workerCount) {
                hashConcat(partialHashes).then(finalHash => {
                  resolve({
                    hash: finalHash,
                    chunkSize,
                  });
                });
              }
              worker.terminate();
              break;

            default:
              reject(new Error(`Unexpected message label received: ${label}`));
              worker.terminate();
              break;
          }
        };

        worker.onerror = error => {
          reject(new Error(`Worker error: ${error.message}`));
          worker.terminate();
        };
        const start = i * fileChunkSize;
        const blobChunk = fileChunks.slice(start, start + fileChunkSize);
        Promise.all(blobChunk.map(async blob => await blob.arrayBuffer())).then(arrayBuffers => {
          worker.postMessage(
            {
              label: WorkerLabelsEnum.INIT,
              data: arrayBuffers,
              index: i,
            },
            arrayBuffers,
          );
        });
      }
    } catch (error) {
      reject(new Error(`Failed to generate file hash with array buffer: ${error}`));
    }
  });
}

async function hashConcat(hashes: string[]): Promise<string> {
  const data = new TextEncoder().encode(hashes.join(''));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(buffer));
  const truncatedHashArray = hashArray.slice(0, 16); // 现在取前 16 个字节
  return truncatedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
