import { PromisePool } from "./promisePool";

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
