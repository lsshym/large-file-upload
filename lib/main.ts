import { createFileChunks } from './apis/createFileChunks';
import { generateChunksHash } from './apis/generateIdUtils/generateChunksHash';
import { generateFileHash } from './apis/generateIdUtils/generateFileHash';
import { UploadHelper } from './apis/uploadHelper/upload.helper.mainThread';
export { generateFileHash, generateChunksHash, createFileChunks, UploadHelper };

// TODO: 要不要提供后端合成api
