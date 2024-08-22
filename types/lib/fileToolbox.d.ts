import { PromisePool } from "./PromisePool";
export type FileChunkResult = {
    fileChunks: Blob[];
    chunkSize: number;
    error?: string;
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
export declare function currentFileChunks(file: File, customChunkSize?: number): Promise<FileChunkResult>;
/**
 * 使用Crypto，生成文件的唯一哈希标识符，基于文件内容和可选的额外参数。
 * 返回值格式化为类似 UUID 的形式（8-4-4-4-12）。
 *
 * @param {File} file - 要生成哈希的文件对象。
 * @param {Record<string, any>} [extraParams={}] - 可选的额外参数对象，将这些参数与文件内容一起参与哈希计算。
 * @returns {Promise<string>} - 返回一个 Promise，解析为格式化后的哈希值（UUID 形式）。
 */
export declare function generateFileHashWithCrypto(file: File, extraParams?: Record<string, any>): Promise<string>;
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
export declare function uploadChunksWithPool({ fileChunks, maxTasks }: UploadOptions, cb: UploadCallback): PromisePool;
