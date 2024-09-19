import { currentFileChunks, FileChunkResult } from './currentFileChunks';
import { WorkerLabelsEnum } from './worker/worker.enum';
/**
 * Generate a Universally Unique Identifier (UUID) version 4.
 * This function uses the crypto API of the browser to generate a secure random number,
 * ensuring the uniqueness and randomness of the UUID.
 * The generated UUID conforms to the format of UUID version 4.
 *
 * If there is no need for fast file uploads, this function can be used.
 *
 * @returns {string} - A string representing the generated UUID.
 */
export function generateUUID() {
  if (window.crypto && window.crypto.getRandomValues) {
    // 使用crypto API生成安全的随机数
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);

    // 按照UUID v4的标准格式化数组中的字节
    arr[6] = (arr[6] & 0x0f) | 0x40; // 第6个字节的高4位设置为4
    arr[8] = (arr[8] & 0x3f) | 0x80; // 第8个字节的高2位设置为10

    // 将字节转换为符合UUID格式的字符串
    return [...arr]
      .map((b, i) =>
        [4, 6, 8, 10].includes(i)
          ? '-' + b.toString(16).padStart(2, '0')
          : b.toString(16).padStart(2, '0'),
      )
      .join('');
  } else {
    // 如果不支持crypto API，则回退到Math.random生成UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

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
  return currentFileChunks(file, customChunkSize)
    .then(async ({ fileChunks, chunkSize }: FileChunkResult) => {
      const value = await generateFileHashWithArrayBuffer(fileChunks);
      return {
        hash: value,
        chunkSize,
      };
    })
    .catch(error => {
      throw new Error(`Failed to generate file hash: ${error}`);
    });
}

function generateFileHashWithArrayBuffer(fileChunks: Blob[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 6);
    const chunkSize = Math.ceil(fileChunks.length / workerCount);
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
                const finalHash = hashConcat(partialHashes);
                resolve(finalHash);
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
        const start = i * chunkSize;
        const blobChunk = fileChunks.slice(start, start + chunkSize);
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
  const truncatedHashArray = hashArray.slice(0, 8); // 取前8个字节
  return truncatedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
