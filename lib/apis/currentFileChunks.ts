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
  // 如果文件不存在或大小为零，则抛出错误
  if (!file || !file.size) {
    throw new Error("File not found or size is 0");
  }
  const { size } = file;
  const BASESIZE = 1024 * 1024; // 假设BASESIZE为1MB

  /**
   * 根据customChunkSize或文件大小计算分块大小。
   * @returns {number} 计算后的分块大小。
   */
  const calculateChunkSize = (): number => {
    if (customChunkSize) {
      // 如果customChunkSize不是有效的数字，则将其设置为4MB
      if (customChunkSize < 1 || isNaN(customChunkSize)) {
        customChunkSize = 4;
      } else {
        customChunkSize = Math.floor(customChunkSize);
      }
      // 根据customChunkSize和BASESIZE计算分块大小
      return customChunkSize * BASESIZE;
    }
    // 根据文件大小确定分块大小。对于小于100MB的文件，分块大小为1MB；
    // 对于100MB到1GB之间的文件，分块大小为4MB；对于大于1GB的文件，分块大小为8MB
    if (size < 100 * BASESIZE) return 1 * BASESIZE;
    if (size < 1024 * BASESIZE) return 4 * BASESIZE;
    return 8 * BASESIZE;
  };

  const CHUNK_SIZE = calculateChunkSize();
  const fileChunks: Blob[] = [];
  let currentChunk = 0;

  // 将文件分割成多个块
  while (currentChunk < size) {
    const endChunk = Math.min(currentChunk + CHUNK_SIZE, size);
    fileChunks.push(file.slice(currentChunk, endChunk));
    currentChunk = endChunk;
  }

  return { fileChunks, chunkSize: CHUNK_SIZE };
}