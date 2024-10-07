export type FileChunkResult = {
  fileChunks: Blob[];
  chunkSize: number;
  error?: string; // Optional error message
};

const BASESIZE = 1024 * 1024; // 1MB

/**
 * Splits the given file into multiple chunks of the specified size. If `customChunkSize` is not provided,
 * the function automatically determines the chunk size based on the file size.
 *
 * @param {File} file - The file to be split.
 * @param {number} [customChunkSize] - Custom size of each chunk (in MB). If the value is less than 1 or not a valid number,
 * the default size is set to 4MB. If the value is not an integer, it is rounded down.
 *
 * @returns {FileChunkResult} Returns an object containing:
 * - `fileChunks`: An array of Blob objects, each representing a chunk of the file.
 * - `chunkSize`: The size of each chunk (in bytes).
 * - `error` (optional): A string containing an error message if an error occurs.
 */
export function createFileChunks(file: File, customChunkSize?: number): FileChunkResult {
  if (!file || !file.size) {
    throw new Error('File not found or size is 0');
  }

  const size = file.size;
  let chunkSize: number;

  if (typeof customChunkSize === 'number' && customChunkSize >= 1) {
    chunkSize = Math.floor(customChunkSize) * BASESIZE;
  } else if (customChunkSize !== undefined) {
    chunkSize = 4 * BASESIZE;
  } else {
    if (size < 100 * BASESIZE) {
      chunkSize = 1 * BASESIZE;
    } else if (size < 1024 * BASESIZE) {
      chunkSize = 5 * BASESIZE;
    } else {
      chunkSize = 10 * BASESIZE;
    }
  }

  const fileChunks: Blob[] = [];
  for (let start = 0; start < size; start += chunkSize) {
    const end = Math.min(start + chunkSize, size);
    fileChunks.push(file.slice(start, end));
  }
  return { fileChunks, chunkSize: chunkSize / BASESIZE };
}
