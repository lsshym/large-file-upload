import { PromisePool } from "./promisePool";

export type FileChunkResult = {
  fileChunks: Blob[];
  chunkSize: number;
  error?: string; // Optional error message
};
/**
 * Splits the given file into multiple chunks of the specified size. If `customChunkSize` is not provided,
 * the function automatically determines the chunk size based on the file size.
 *
 * @param {File} file - The file to be split.
 * @param {number} [customChunkSize] - Custom size of each chunk (in MB). If the value
 * is less than 1 or is not a valid number, the default size is 4MB. If the value is not an integer, it is rounded down.
 *
 * @returns {FileChunkResult} Returns an object with the following properties:
 * - `fileChunks`: An array of Blob objects, each representing a chunk of the file.
 * - `chunkSize`: The size of each chunk (in bytes).
 */
export async function currentFileChunks(
  file: File,
  customChunkSize?: number
): Promise<FileChunkResult> {
  // If the file does not exist or the size is zero, return an empty result
  if (!file || !file.size) {
    throw new Error("File not found or size is 0");
  }
  const { size } = file;
  const BASESIZE = 1024 * 1024; // Assume BASESIZE is 1MB

  /**
   * Calculates the chunk size based on customChunkSize or the file size.
   * @returns {number} The calculated chunk size.
   */
  const calculateChunkSize = (): number => {
    if (customChunkSize) {
      // If customChunkSize is not a valid number, set it to 4MB
      if (customChunkSize < 1 || isNaN(customChunkSize)) {
        customChunkSize = 4;
      } else {
        customChunkSize = Math.floor(customChunkSize);
      }
      // Calculate chunk size based on customChunkSize and BASESIZE
      return customChunkSize * BASESIZE;
    }
    // Determine chunk size based on file size. For files smaller than 100MB, the chunk size is 1MB;
    // for files between 100MB and 1GB, the chunk size is 4MB; for files larger than 1GB, the chunk size is 8MB
    if (size < 100 * BASESIZE) return 1 * BASESIZE;
    if (size < 1024 * BASESIZE) return 4 * BASESIZE;
    return 8 * BASESIZE;
  };

  const CHUNK_SIZE = calculateChunkSize();
  const fileChunks: Blob[] = [];
  let currentChunk = 0;

  // Split the file into multiple chunks
  while (currentChunk < size) {
    const endChunk = Math.min(currentChunk + CHUNK_SIZE, size);
    fileChunks.push(file.slice(currentChunk, endChunk));
    currentChunk = endChunk;
  }

  return { fileChunks, chunkSize: CHUNK_SIZE };
}

/**
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
): Promise<string> {
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

  // Return the results of the task pool execution
  return pool;
}