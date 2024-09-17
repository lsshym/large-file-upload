import { createMD5 } from 'hash-wasm';
import { currentFileChunks, FileChunkResult } from './currentFileChunks';
import { WorkerLabelsEnum, WorkerMessage } from './worker/worker.enum';

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

/**
 * This func seems redundant.
 * Generates a SHA-256 hash for small files (Maximum not exceeding 2GB).
 * Generates a unique hash identifier for the file using Crypto, based on the file content and optional extra parameters.
 *
 * @param {File} file - The file object for which to generate the hash.
 * @param {Record<string, any>} [extraParams={}] - Optional extra parameters object, which will be included in the hash computation along with the file content.
 * @returns {Promise<string>} - Returns a Promise that resolves to the hash value.
 */
export async function generateSmallFileHash(file: File) {
  const fileContentArrayBuffer = await file.arrayBuffer();
  // Encode extra parameters
  const combinedData: Uint8Array = new Uint8Array(fileContentArrayBuffer);

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', combinedData);

  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface FileHashResult {
  hash: string;
  chunkSize: number;
}
/**
 * Generates a hash for the given file.
 *
 * @param {File} file - The file for which to generate the hash.
 * @param {number} [customChunkSize] - Optional custom size for file chunks.
 * @returns {Promise<FileHashResult>} - A promise that resolves to an object containing the hash and chunk size.
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

/**
 * Generates a hash using an array of ArrayBuffers.
 *
 * @param {ArrayBuffer[]} arrayBuffers - An array of ArrayBuffer objects containing file data chunks.
 * @returns {Promise<string>} - A promise that resolves to the generated hash as a string.
 */
export function generateFileHashWithArrayBuffer(arrayBuffers: ArrayBuffer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 如何开多个worker加速计算，
      const worker = new Worker(new URL('./worker/md5.worker.ts', import.meta.url), {
        type: 'module',
      });

      // 监听Worker的消息事件
      worker.onmessage = (event: MessageEvent) => {
        const { label, data }: WorkerMessage = event.data;

        switch (label) {
          case WorkerLabelsEnum.DONE:
            console.log('data: ${data}', data);
 
            resolve(data as string);
            worker.terminate(); // 在任务完成后终止Worker
            break;

          default:
            reject(new Error(`Unexpected message label received: ${label}, data: ${data}`));
            worker.terminate(); // 未预期的消息也终止Worker
            break;
        }
      };
      // 处理Worker的错误事件
      worker.onerror = error => {
        reject(new Error(`Worker error: ${error.message}`));
        worker.terminate(); // 在发生错误时终止Worker
      };

      worker.postMessage(
        {
          label: WorkerLabelsEnum.INIT,
          data: arrayBuffers,
        },
        arrayBuffers,
      );
    } catch (error) {
      reject(new Error(`Failed to generate file hash with array buffer: ${error}`));
    }
  });
}

export function generateFileHashTest(
  file: File,
  customChunkSize?: number,
): Promise<FileHashResult> {
  return currentFileChunks(file, customChunkSize)
    .then(async ({ fileChunks, chunkSize }: FileChunkResult) => {
      //如果避免内存占用过多，添加一点到woker，然后释放资源
      const arrayBuffers = await Promise.all(fileChunks.map(chunk => chunk.arrayBuffer()));
      const value = await generateFileHashWithArrayBufferTest(arrayBuffers);

      return {
        hash: value,
        chunkSize,
      };
    })
    .catch(error => {
      throw new Error(`Failed to generate file hash: ${error}`);
    });
}

/**
 * 使用 Web Worker 并行计算文件哈希。
 *
 * @param {ArrayBuffer[]} arrayBuffers - 文件数据块组成的数组。
 * @returns {Promise<string>} - 返回计算的文件哈希值。
 */
export function generateFileHashWithArrayBufferTest(arrayBuffers: ArrayBuffer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerCount = 1; // 假设使用 4 个 worker
    const chunkSize = Math.ceil(arrayBuffers.length / workerCount);
    const workers: Worker[] = [];
    const chunks: { index: number; buffer: Uint8Array }[] = []; // 每个块添加 index 以保证顺序
    let completedWorkers = 0;

    try {
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(new URL('./worker/md5.worker.test.ts', import.meta.url), {
          type: 'module',
        });
        workers.push(worker);

        worker.onmessage = (event: MessageEvent) => {
          const {
            label,
            data,
            index,
          }: { label: WorkerLabelsEnum; data: Uint8Array; index: number } = event.data;

          switch (label) {
            case WorkerLabelsEnum.DONE:
              chunks.push({ index, buffer: data }); // 保存带有索引的数据块
              completedWorkers++;

              if (completedWorkers === workerCount) {
                // 确保按照 index 对数据块排序后合并
                console.log(chunks)
                const sortedChunks = chunks.sort((a, b) => a.index - b.index);
                const combinedBuffer = mergeChunks(sortedChunks.map(c => c.buffer));
                console.log('datatest: ${datatest}', data);
                calculateMD5(combinedBuffer).then(hash => {
                  resolve(hash);
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

        // 每个 worker 处理文件的部分块，并附带块的索引值
        const start = i * chunkSize;
        const chunk = arrayBuffers.slice(start, start + chunkSize);
        console.log(chunk);
        worker.postMessage(
          {
            label: WorkerLabelsEnum.INIT,
            data: chunk,
            index: i, // 将索引传递给 worker
          },
          chunk,
        );
      }
    } catch (error) {
      reject(new Error(`Failed to generate file hash with array buffer: ${error}`));
    }
  });
}

/**
 * 合并所有块的数据。
 *
 * @param {Uint8Array[]} chunks - 每个块的数据。
 * @returns {Uint8Array} - 合并后的完整文件数据。
 */
function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/**
 * 使用 MD5 对合并后的文件数据进行全局哈希计算。
 *
 * @param {Uint8Array} data - 完整的文件数据。
 * @returns {string} - 返回计算的 MD5 哈希值。
 */
async function calculateMD5(data: Uint8Array): Promise<string> {
  const md5 = await createMD5(); // 使用 await 等待 Promise resolve
  md5.update(data); // 调用 update 方法
  return md5.digest('hex'); // 计算并返回 MD5 哈希值
}
