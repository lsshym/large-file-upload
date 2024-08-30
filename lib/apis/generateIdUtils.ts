import { currentFileChunks, FileChunkResult } from "./currentFileChunks";
import { WorkerLabelsEnum, WorkerMessage } from "./worker/worker.enum";

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
          ? "-" + b.toString(16).padStart(2, "0")
          : b.toString(16).padStart(2, "0")
      )
      .join("");
  } else {
    // 如果不支持crypto API，则回退到Math.random生成UUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Generates a SHA-256 hash for small files (up to 2GB).
 * Generates a unique hash identifier for the file using Crypto, based on the file content and optional extra parameters.
 * The return value is formatted in a UUID-like form (8-4-4-4-12).
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
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a hash for the given file.
 *
 * @param {File} file - The file for which to generate the hash.
 * @param {number} [customChunkSize] - Optional custom size for file chunks.
 * @returns {Promise<{ hash: string, chunkSize: number }>} - A promise that resolves to an object containing the hash and chunk size.
 */
export function generateFileHash(file: File, customChunkSize?: number) {
  return new Promise(async (resolve, reject) => {
    try {
      const { fileChunks, chunkSize }: FileChunkResult =
        await currentFileChunks(file, customChunkSize);

      const arrayBuffers = await Promise.all(
        fileChunks.map((chunk) => chunk.arrayBuffer())
      );

      const value = await generateFileHashWithArrayBuffer(arrayBuffers);

      resolve({
        hash: value,
        chunkSize,
      });
    } catch (error) {
      reject(new Error(`Failed to generate file hash: ${error}`));
    }
  });
}

/**
 * Generates a hash using an array of ArrayBuffers.
 *
 * @param {ArrayBuffer[]} arrayBuffers - An array of ArrayBuffer objects containing file data chunks.
 * @returns {Promise<string>} - A promise that resolves to the generated hash as a string.
 */
export function generateFileHashWithArrayBuffer(arrayBuffers: ArrayBuffer[]) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL("./worker/md5.worker.ts", import.meta.url),
        {
          type: "module",
        }
      );

      worker.onmessage = (event: MessageEvent) => {
        const { label, data }: WorkerMessage = event.data;

        if (label === WorkerLabelsEnum.DONE) {
          resolve(data);
        } else {
          reject(new Error(`Unexpected message label received: ${label}`));
        }
      };

      worker.onerror = (error) => {
        reject(new Error(`Worker error: ${error.message}`));
      };

      worker.postMessage(
        {
          label: WorkerLabelsEnum.INIT,
          data: arrayBuffers,
        },
        arrayBuffers
      );
    } catch (error) {
      reject(
        new Error(`Failed to generate file hash with array buffer: ${error}`)
      );
    }
  });
}
