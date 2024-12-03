import { createFileChunks } from './apis/createFileChunks';
import { generateChunksHash } from './apis/generateIdUtils/generateChunksHash';
import { generateFileFingerprint } from './apis/generateIdUtils/generateFileFingerprint';
import { generateUUID } from './apis/generateIdUtils/generateUUID';
import { TaskQueueManager } from './apis/TaskQueueManager';
export {
  createFileChunks,
  generateUUID,
  generateFileFingerprint,
  generateChunksHash,
  TaskQueueManager,
};

// TODO: 提供后端合成api, 目前提供不了，太麻烦，新建一个库再说
