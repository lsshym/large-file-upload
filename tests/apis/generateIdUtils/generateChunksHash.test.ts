import { generateChunksHash } from '../../../lib/apis/generateIdUtils/generateChunksHash';

type WorkerMockAction = {
  label?: string;
  data?: string;
  delay?: number;
};

type ChunksHashWorkerMockState = {
  instances: Array<{ terminated: boolean }>;
  chunkMessages: Array<{ message: { data: { index: number } } }>;
  terminatedCount: number;
};

type ChunksHashWorkerMockGlobal = typeof globalThis & {
  __workerMockConfig?: {
    chunks?: Record<number, WorkerMockAction>;
    chunksDelays?: Record<number, number>;
  };
  __workerMockState?: ChunksHashWorkerMockState;
};

const workerMockGlobal = globalThis as ChunksHashWorkerMockGlobal;

function withTimeout<T>(promise: Promise<T>, timeout = 50): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>(resolve => {
      setTimeout(() => resolve('timeout'), timeout);
    }),
  ]);
}

describe('generateChunksHash', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    workerMockGlobal.__workerMockConfig = undefined;
    workerMockGlobal.__workerMockState = undefined;
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }

    workerMockGlobal.__workerMockConfig = undefined;
    workerMockGlobal.__workerMockState = undefined;
  });

  it('resolves an empty chunk list', async () => {
    const result = await withTimeout(generateChunksHash([]));

    expect(result).toEqual([]);
  });

  it('waits for every chunk when worker results arrive out of order', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 8 },
    });

    const result = await generateChunksHash([
      new Blob(['chunk-a']),
      new Blob(['chunk-b']),
      new Blob(['chunk-c']),
    ]);

    expect(result).toEqual(['hash-0', 'hash-1', 'hash-2']);
  });

  it('limits worker count to the number of chunks', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 16 },
    });

    await generateChunksHash([new Blob(['chunk-a']), new Blob(['chunk-b'])]);

    expect(workerMockGlobal.__workerMockState?.instances).toHaveLength(2);
  });

  it('falls back to four workers when hardwareConcurrency is unavailable', async () => {
    const chunks = Array.from({ length: 6 }, (_, index) => new Blob([`chunk-${index}`]));

    await generateChunksHash(chunks);

    expect(workerMockGlobal.__workerMockState?.instances).toHaveLength(4);
    expect(workerMockGlobal.__workerMockState?.chunkMessages).toHaveLength(6);
  });

  it('rejects and terminates all workers when a worker reports an error', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 4 },
    });
    workerMockGlobal.__workerMockConfig = {
      chunks: {
        1: {
          label: 'ERROR',
          data: 'md5 failed',
        },
      },
    };

    await expect(generateChunksHash([new Blob(['chunk-a']), new Blob(['chunk-b'])])).rejects.toThrow(
      'Worker 1 reported error: md5 failed',
    );
    expect(workerMockGlobal.__workerMockState?.terminatedCount).toBe(2);
  });

  it('ignores late messages after the promise has been rejected', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 4 },
    });
    workerMockGlobal.__workerMockConfig = {
      chunks: {
        0: {
          label: 'ERROR',
          data: 'first failure',
          delay: 0,
        },
        1: {
          delay: 10,
        },
      },
    };

    await expect(generateChunksHash([new Blob(['chunk-a']), new Blob(['chunk-b'])])).rejects.toThrow(
      'Worker 0 reported error: first failure',
    );
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(workerMockGlobal.__workerMockState?.terminatedCount).toBe(2);
  });
});
