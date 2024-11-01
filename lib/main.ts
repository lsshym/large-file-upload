// 导出时使用动态导入，生成可分割的代码块
export const generateFileHash = () => import('./apis/generateIdUtils/generateFileHash');
export const createFileChunks = () => import('./apis/createFileChunks');
export const UploadHelper = () => import('./apis/uploadHelper/upload.helper.mainThread');

// export { generateFileHash, createFileChunks, UploadHelper };
