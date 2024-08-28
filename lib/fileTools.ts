import { PromisePool } from "./promisePool";
// const worker = new Worker(new URL("./worker.ts", import.meta.url), {
//   type: "module",
// });

/**
 * 只适用2G以下的文件，超过2G ArrayBuffer会爆
 * Generates a unique hash identifier for the file using Crypto, based on the file content and optional extra parameters.
 * The return value is formatted in a UUID-like form (8-4-4-4-12).
 *
 * @param {File} file - The file object for which to generate the hash.
 * @param {Record<string, any>} [extraParams={}] - Optional extra parameters object, which will be included in the hash computation along with the file content.
 * @returns {Promise<string>} - Returns a Promise that resolves to the formatted hash value (in UUID form).
 */
export async function generateFileHashWithCrypto(
  file: File,
  extraParams: Record<string, any> = {}
) {
  // worker.postMessage('test')

  // Read file content and convert to ArrayBuffer
  const fileContentArrayBuffer = await file.arrayBuffer();
  // Encode extra parameters
  let combinedData: Uint8Array;
  if (Object.keys(extraParams).length > 0) {
    // Convert extra parameters object to a string and encode it
    const paramsString = Object.entries(extraParams)
      .map(([key, value]) => `${key}:${value}`)
      .join("-");
    const encoder = new TextEncoder();
    const paramsArray = encoder.encode(paramsString);

    // Combine extra parameters with file content
    combinedData = new Uint8Array(
      paramsArray.length + fileContentArrayBuffer.byteLength
    );
    combinedData.set(paramsArray, 0);
    combinedData.set(
      new Uint8Array(fileContentArrayBuffer),
      paramsArray.length
    );
  } else {
    // If no extra parameters, use only the file content for hashing
    combinedData = new Uint8Array(fileContentArrayBuffer);
  }

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert hash to hexadecimal string and format as UUID
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format as UUID (8-4-4-4-12)
  return `${hashHex.slice(0, 8)}-${hashHex.slice(8, 12)}-${hashHex.slice(
    12,
    16
  )}-${hashHex.slice(16, 20)}-${hashHex.slice(20, 32)}`;
}

/**
 * Represents a file chunk to be uploaded.
 * Modify this type according to the actual data structure.
 */
export type FileChunk = any;

/**
 * Callback function type for handling the upload of a single file chunk.
 *
 * @param {FileChunk} item - The file chunk to be uploaded.
 * @param {number} index - The index of the file chunk in the array.
 * @returns {Promise<any>} - Returns a Promise representing the result of the upload.
 */
export type UploadCallback = (item: FileChunk, index: number) => Promise<any>;

/**
 * Configuration options for file upload.
 *
 * @property {FileChunk[]} fileChunks - An array of file chunks to be uploaded.
 * @property {number} [maxTasks=4] - The maximum number of concurrent upload tasks, default is 4.
 */
export interface UploadOptions {
  fileChunks: FileChunk[];
  maxTasks?: number;
}

/**
 * Controls the concurrent upload of file chunks using PromisePool.
 *
 * @param {UploadOptions} options - Upload options, including the array of file chunks and the maximum number of concurrent tasks.
 * @param {UploadCallback} cb - Callback function to handle the upload of a single file chunk.
 * @returns {Promise<any>[]} - Returns an array of Promises representing the results of all uploads.
 */
export function uploadChunksWithPool(
  { fileChunks, maxTasks = 4 }: UploadOptions,
  cb: UploadCallback
): PromisePool {
  // Convert fileChunks into an array of asynchronous tasks
  const tasks = fileChunks.map((item, index) => {
    return async () => {
      // Call the callback function to perform the upload and return a Promise
      return cb(item, index);
    };
  });

  // Create a PromisePool instance and execute the task pool
  const pool = new PromisePool(tasks, maxTasks);
  // const pool = new PromisePoolTest(tasks, maxTasks);

  // Return the results of the task pool execution
  return pool;
}
