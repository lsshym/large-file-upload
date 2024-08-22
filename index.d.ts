// index.d.ts

// 从 fileToolbox.ts 导出的类型和函数
export type { FileChunkResult, UploadOptions, UploadCallback } from './lib/fileToolbox';
export { currentFileChunks, generateFileHashWithCrypto, uploadChunksWithPool } from './lib/fileToolbox';

// 从 promisePool.ts 导出的 PromisePool 类
export { PromisePool } from './lib/PromisePool';
