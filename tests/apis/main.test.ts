import * as api from '../../lib/main';
import { createFileChunks } from '../../lib/apis/createFileChunks';
import { generateChunksHash } from '../../lib/apis/generateIdUtils/generateChunksHash';
import { generateFileFingerprint } from '../../lib/apis/generateIdUtils/generateFileFingerprint';
import { generateFileMd5 } from '../../lib/apis/generateIdUtils/generateFileMd5';
import { TaskQueueManager } from '../../lib/apis/TaskQueueManager';

describe('public lib entrypoint', () => {
  it('exports the npm-facing APIs from lib/main', () => {
    expect(api.createFileChunks).toBe(createFileChunks);
    expect(api.generateFileMd5).toBe(generateFileMd5);
    expect(api.generateFileFingerprint).toBe(generateFileFingerprint);
    expect(api.generateChunksHash).toBe(generateChunksHash);
    expect(api.TaskQueueManager).toBe(TaskQueueManager);
  });
});
