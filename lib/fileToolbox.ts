import { PromisePool } from "./promisePool";

export type FileChunkResult = {
  fileChunks: Blob[];
  chunkSize: number;
  error?: string; // 可选的错误信息
};
/**
 * 将给定的文件按指定大小分割成多个块。如果未提供 `customChunkSize`，
 * 函数会根据文件大小自动确定块的大小。
 *
 * @param {File} file - 要分割的文件。
 * @param {number} [customChunkSize] - 每个块的自定义大小（以MB为单位）。如果值
 * 小于1或不是有效数字，默认大小为4MB。如果值不是整数，则向下取整。
 *
 * @returns {FileChunkResult} 返回一个包含以下属性的对象：
 * - `fileChunks`: Blob 对象数组，每个 Blob 对象表示文件的一个块。
 * - `CHUNK_SIZE`: 每个块的大小（以字节为单位）。
 */
export async function currentFileChunks(
  file: File,
  customChunkSize?: number
): Promise<FileChunkResult> {
  // 如果文件不存在，或者大小为零，返回空结果
  if (!file || !file.size) {
    throw new Error("File not found or size is 0");
  }
  const { size } = file;
  const BASESIZE = 1024 * 1024; // 假设 BASESIZE 为 1MB

  /**
   * 根据 customChunkSize 或文件大小计算块大小
   * @returns {number} 计算后的块大小
   */
  const calculateChunkSize = (): number => {
    if (customChunkSize) {
      // 如果 customChunkSize 不是有效数字，则设置为 4MB
      if (customChunkSize < 1 || isNaN(customChunkSize)) {
        customChunkSize = 4;
      } else {
        customChunkSize = Math.floor(customChunkSize);
      }
      // 根据 customChunkSize 和 BASESIZE 计算块大小
      return customChunkSize * BASESIZE;
    }
    // 根据文件大小确定块的大小。对于小于100MB的文件，块大小为1MB；
    // 对于100MB到1GB之间的文件，块大小为4MB；对于大于1GB的文件，块大小为8MB
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

/**
 * 使用Crypto，生成文件的唯一哈希标识符，基于文件内容和可选的额外参数。
 * 返回值格式化为类似 UUID 的形式（8-4-4-4-12）。
 *
 * @param {File} file - 要生成哈希的文件对象。
 * @param {Record<string, any>} [extraParams={}] - 可选的额外参数对象，将这些参数与文件内容一起参与哈希计算。
 * @returns {Promise<string>} - 返回一个 Promise，解析为格式化后的哈希值（UUID 形式）。
 */
export async function generateFileHashWithCrypto(
  file: File,
  extraParams: Record<string, any> = {}
): Promise<string> {
  // 读取文件内容并转换为 ArrayBuffer
  const fileContentArrayBuffer = await file.arrayBuffer();

  // 编码额外参数
  let combinedData: Uint8Array;
  if (Object.keys(extraParams).length > 0) {
    // 将额外参数对象转换为字符串，并进行编码
    const paramsString = Object.entries(extraParams)
      .map(([key, value]) => `${key}:${value}`)
      .join("-");
    const encoder = new TextEncoder();
    const paramsArray = encoder.encode(paramsString);

    // 将额外参数与文件内容组合在一起
    combinedData = new Uint8Array(
      paramsArray.length + fileContentArrayBuffer.byteLength
    );
    combinedData.set(paramsArray, 0);
    combinedData.set(
      new Uint8Array(fileContentArrayBuffer),
      paramsArray.length
    );
  } else {
    // 如果没有额外参数，则只使用文件内容进行哈希
    combinedData = new Uint8Array(fileContentArrayBuffer);
  }

  // 生成 SHA-256 哈希
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 将哈希转换为十六进制字符串，并格式化为 UUID 样式
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 格式化为 UUID 形式 (8-4-4-4-12)
  return `${hashHex.slice(0, 8)}-${hashHex.slice(8, 12)}-${hashHex.slice(
    12,
    16
  )}-${hashHex.slice(16, 20)}-${hashHex.slice(20, 32)}`;
}

/**
 * 表示需要上传的文件块。
 * 根据实际数据结构修改此类型。
 */
export type FileChunk = any;

/**
 * 处理单个文件块上传的回调函数类型。
 *
 * @param {FileChunk} item - 需要上传的文件块。
 * @param {number} index - 文件块在数组中的索引。
 * @returns {Promise<any>} 返回一个表示上传结果的 Promise。
 */
export type UploadCallback = (item: FileChunk, index: number) => Promise<any>;

/**
 * 文件上传的选项配置。
 *
 * @property {FileChunk[]} fileChunks - 需要上传的文件块数组。
 * @property {number} [maxTasks=4] - 最大并发上传任务数，默认为4。
 */
export interface UploadOptions {
  fileChunks: FileChunk[];
  maxTasks?: number;
}

/**
 * 使用 PromisePool 控制并发上传文件块。
 *
 * @param {UploadOptions} options - 上传选项，包括文件块数组和最大并发任务数。
 * @param {UploadCallback} cb - 处理单个文件块上传的回调函数。
 * @returns {Promise<any>[]} 返回一个包含所有上传结果的 Promise 数组。
 */
export function uploadChunksWithPool(
  { fileChunks, maxTasks = 4 }: UploadOptions,
  cb: UploadCallback
): PromisePool {
  // 将 fileChunks 转换为异步任务的数组
  const tasks = fileChunks.map((item, index) => {
    return async () => {
      // 调用回调函数执行上传操作，并返回 Promise
      return cb(item, index);
    };
  });

  // 创建 PromisePool 实例并执行任务池
  const pool = new PromisePool(tasks, maxTasks);

  // 返回任务池执行的结果
  return pool;
}
