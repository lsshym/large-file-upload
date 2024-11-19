import { createFileChunks } from './apis/createFileChunks';
import { generateChunksHash } from './apis/generateIdUtils/generateChunksHash';
import { generateFileHash } from './apis/generateIdUtils/generateFileHash';
import { UploadHelper } from './apis/uploadHelper/upload.helper.mainThread';
export { generateFileHash, generateChunksHash, createFileChunks, UploadHelper };

// TODO: 提供后端合成api, 目前提供不了，太麻烦，新建一个库再说
