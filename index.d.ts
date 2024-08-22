// 定义用于处理文件块的返回类型
export type FileChunkResult = {
    fileChunks: Blob[];
    chunkSize: number;
    error?: string; // 可选的错误信息
  };
  
  // 定义上传文件块的选项配置
  export interface UploadOptions {
    fileChunks: any[];
    maxTasks?: number;
  }
  
  // 定义处理单个文件块上传的回调函数类型
  export type UploadCallback = (item: any, index: number) => Promise<any>;
  
  // PromisePool 类的定义
  export class PromisePool {
    constructor(functions: Array<() => Promise<any>>, maxConcurrentTasks?: number);
    exec<T>(): Promise<T[]>;
    pause(): void;
    resume(): void;
    clear(): void;
    addTasks(newTasks: Array<() => Promise<any>>): void;
  }
  
  // 文件切片函数
  export function currentFileChunks(
    file: File,
    customChunkSize?: number
  ): Promise<FileChunkResult>;
  
  // 文件哈希生成函数
  export function generateFileHashWithCrypto(
    file: File,
    extraParams?: Record<string, any>
  ): Promise<string>;
  
  // 并发上传函数
  export function uploadChunksWithPool(
    options: UploadOptions,
    cb: UploadCallback
  ): PromisePool;
  