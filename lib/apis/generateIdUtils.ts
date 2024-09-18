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
      //如果避免内存占用过多，添加一点到woker，然后释放资源
      const arrayBuffers = await Promise.all(fileChunks.map(chunk => chunk.arrayBuffer()));
      const value = await generateFileHashWithArrayBuffer(arrayBuffers);

      return {
        hash: value,
        chunkSize,
      };
    })
    .catch(error => {
      throw new Error(`Failed to generate file hash: ${error}`);
    });
}

function generateFileHashWithArrayBuffer(arrayBuffers: ArrayBuffer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerCount = 6; // 测试后使用6个最佳
    const chunkSize = Math.ceil(arrayBuffers.length / workerCount);
    const workers: Worker[] = [];
    const partialHashes: { index: number; hashState: string }[] = [];
    let completedWorkers = 0;

    try {
      // 创建主线程的 MD5 对象，用于合并所有中间状态
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(new URL('./worker/md5.workers.ts', import.meta.url), {
          type: 'module',
        });
        workers.push(worker);
        worker.onmessage = (event: MessageEvent) => {
          const { label, data, index } = event.data;

          switch (label) {
            case WorkerLabelsEnum.DONE:
              // 保存每个块的 MD5 中间状态
              partialHashes.push({ index, hashState: data });
              completedWorkers++;

              if (completedWorkers === workerCount) {
                // 按照块的顺序合并所有 MD5 的中间状态
                const results = partialHashes
                  .sort((a, b) => a.index - b.index)
                  .map(({ hashState }) => hashState);
                const finalHash = hashConcat(results);
                // 调用 digestMessage 生成最终的 MD5 哈希
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
        // 将每个文件块分配给 Worker，并附带块的索引值
        const start = i * chunkSize;
        const chunk = arrayBuffers.slice(start, start + chunkSize);
        worker.postMessage(
          {
            label: WorkerLabelsEnum.INIT,
            data: chunk,
            index: i, // 将索引传递给 Worker
          },
          chunk,
        );
      }
    } catch (error) {
      reject(new Error(`Failed to generate file hash with array buffer: ${error}`));
    }
  });
}
async function hashConcat(strings: string[]): Promise<string> {
  const combinedString = strings.join('');
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedString);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
