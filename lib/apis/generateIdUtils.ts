import { currentFileChunks, FileChunkResult } from './currentFileChunks';
import { WorkerLabelsEnum } from './md5.workers';

export interface FileHashResult {
  hash: string;
  chunkSize: number;
}
const maxSampleCount = 100;

/**
 * Generates a hash for the given file by dividing it into chunks and processing them in parallel using Web Workers.
 *
 * The function splits the file into chunks and utilizes multiple Web Workers to compute partial hashes concurrently,
 * enhancing performance, especially for large files. It then combines these partial hashes to produce the final hash value.
 * If `customChunkSize` is not provided or is invalid, a default chunk size is used.
 *
 * @param {File} file - The file to generate the hash for.
 * @param {number} [customChunkSize] - Optional custom size for file chunks (in MB).
 * If the value is less than 1 or not a valid number, the default size is set.
 * If the value is not an integer, it is rounded down.
 *
 * @returns {Promise<FileHashResult>} A promise that resolves to an object containing:
 * - `hash`: A string representing the final hash of the file.
 * - `chunkSize`: The size of each chunk used during hashing (in MB).
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
        const worker = new Worker(new URL('./md5.workers.ts', import.meta.url), {
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
                hashConcat(partialHashes)
                  .then(finalHash => {
                    resolve({
                      hash: finalHash,
                      chunkSize,
                    });
                  })
                  .catch(error => {
                    let errorMessage = 'Unknown error';
                    if (error instanceof Error) {
                      errorMessage = `${error.message}\n${error.stack}`;
                    } else {
                      errorMessage = String(error);
                    }
                    reject(new Error(`Failed to concatenate hashes: ${errorMessage}`));
                  });
              }
              worker.terminate();
              break;

            case WorkerLabelsEnum.ERROR:
              reject(new Error(`Worker ${index} reported error: ${data}`));
              worker.terminate();
              break;

            default:
              reject(new Error(`Unexpected message label received from worker ${index}: ${label}`));
              worker.terminate();
              break;
          }
        };

        worker.onerror = event => {
          let errorMessage = 'Unknown worker error';
          if (event instanceof ErrorEvent) {
            errorMessage = `Message: ${event.message}\nFilename: ${event.filename}\nLine: ${event.lineno}\nColumn: ${event.colno}\nError: ${event.error}`;
          } else {
            errorMessage = JSON.stringify(event);
          }
          reject(new Error(`Worker error: ${errorMessage}`));
          workers.forEach(w => w.terminate()); // 终止所有 Worker
        };

        const start = i * fileChunkSize;
        const blobChunk = fileChunks.slice(start, start + fileChunkSize);
        const sampledChunks = deterministicSampling(blobChunk, maxSampleCount, 5, 0.1);
        Promise.all(sampledChunks.map(blob => blob.arrayBuffer()))
          .then(arrayBuffers => {
            worker.postMessage(
              {
                label: WorkerLabelsEnum.DOING,
                data: arrayBuffers,
                index: i,
              },
              arrayBuffers,
            );
          })
          .catch(error => {
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
              errorMessage = `${error.message}\n${error.stack}`;
            } else {
              errorMessage = String(error);
            }
            reject(new Error(`Failed to read file chunks: ${errorMessage}`));
          });
      }
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = `${error.message}\n${error.stack}`;
      } else {
        errorMessage = String(error);
      }
      reject(new Error(`Failed to generate file hash with array buffer: ${errorMessage}`));
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

/**
 * 确定性抽样分块的函数。保证同一个文件在每次抽样时结果一致。
 *
 * @param {Blob[]} chunks - 文件分块数组。
 * @param {number} maxSampleCount - 最大抽样数量，用于限制总抽样数目。
 * @param {number} [minSampleCount=5] - 最小抽样数量，用于确保最少的样本数目。
 * @param {number} [sampleRate=0.1] - 抽样比例 (0-1 之间)，用于计算抽样的目标数量。
 * @returns {Blob[]} 抽样后的分块数组。
 */
function deterministicSampling(
  chunks: Blob[],
  maxSampleCount: number,
  minSampleCount: number = 5,
  sampleRate: number = 0.1,
): Blob[] {
  // 确保 sampleRate 在 0-1 之间
  sampleRate = Math.max(0, Math.min(1, sampleRate));

  // 根据抽样比例计算目标抽样数量
  let targetSampleCount = Math.floor(chunks.length * sampleRate);

  // 目标数量在最小和最大范围内调整
  targetSampleCount = Math.max(minSampleCount, Math.min(maxSampleCount, targetSampleCount));

  // 如果块数量少于目标数量，则直接返回所有块
  if (chunks.length <= targetSampleCount) {
    return chunks;
  }

  // 使用一个固定的种子，确保每次抽样的结果一致
  const seed = 12345; // 可以根据文件的某个特征生成，例如文件名的哈希

  // 将块数组的索引与种子结合，用于计算权重
  const weightedChunks = chunks.map((chunk, index) => {
    const weight = (index + seed) % chunks.length; // 基于种子和索引生成一个权重
    return { chunk, weight };
  });

  // 按权重排序，确保选择前 targetSampleCount 个块
  weightedChunks.sort((a, b) => a.weight - b.weight);

  // 取排序后前 targetSampleCount 个块
  const sampledChunks = weightedChunks.slice(0, targetSampleCount).map(item => item.chunk);

  return sampledChunks;
}
