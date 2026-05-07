import { webcrypto } from 'node:crypto';
import { generateFileFingerprint } from '../../../lib/apis/generateIdUtils/generateFileFingerprint';

type WorkerMockAction = {
  label?: string;
  data?: string;
  delay?: number;
  onerror?: unknown;
};

type FileFingerprintWorkerMockState = {
  instances: Array<{ terminated: boolean }>;
  fileMessages: Array<{
    message: {
      data: ArrayBuffer[];
      index: number;
    };
    transfer?: ArrayBuffer[];
  }>;
  terminatedCount: number;
};

type FileFingerprintWorkerMockGlobal = typeof globalThis & {
  __workerMockConfig?: {
    file?: Record<number, WorkerMockAction>;
    fileDelays?: Record<number, number>;
  };
  __workerMockState?: FileFingerprintWorkerMockState;
};

const workerMockGlobal = globalThis as FileFingerprintWorkerMockGlobal;

function withTimeout<T>(promise: Promise<T>, timeout = 50): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>(resolve => {
      setTimeout(() => resolve('timeout'), timeout);
    }),
  ]);
}

describe('generateFileFingerprint', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

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

    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', originalCrypto);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }

    workerMockGlobal.__workerMockConfig = undefined;
    workerMockGlobal.__workerMockState = undefined;
  });

  it('generates the same fingerprint regardless of worker count', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    const file = new File([new Uint8Array(3 * 1024 * 1024)], 'three-mb.bin');

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 2 },
    });
    const oneWorkerResult = await generateFileFingerprint(file);
    const oneWorkerMessages = [...(workerMockGlobal.__workerMockState?.fileMessages || [])]
      .sort((left, right) => left.message.index - right.message.index)
      .map(({ message }) => message.data.length);

    workerMockGlobal.__workerMockConfig = undefined;
    workerMockGlobal.__workerMockState = undefined;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 8 },
    });
    const fourWorkerResult = await generateFileFingerprint(file);
    const fourWorkerMessages = [...(workerMockGlobal.__workerMockState?.fileMessages || [])]
      .sort((left, right) => left.message.index - right.message.index)
      .map(({ message }) => message.data.length);

    expect(oneWorkerMessages).toEqual([3]);
    expect(fourWorkerMessages).toEqual([1, 1, 1]);
    expect(fourWorkerResult).toBe(oneWorkerResult);
  });

  it('settles when hardwareConcurrency is odd', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 7 },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });

    const file = new File(['hello world'], 'hello.txt');
    const result = await withTimeout(generateFileFingerprint(file));

    expect(result).not.toBe('timeout');
    if (result === 'timeout') return;

    expect(result).toMatch(/^[a-f0-9]{32}$/);
  });

  it('does not start extra fingerprint workers for empty work groups', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 8 },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });

    await generateFileFingerprint(new File(['hello'], 'hello.txt'));

    expect(workerMockGlobal.__workerMockState?.instances).toHaveLength(1);
    const messagesByIndex = [...(workerMockGlobal.__workerMockState?.fileMessages || [])].sort(
      (left, right) => left.message.index - right.message.index,
    );
    expect(messagesByIndex.map(({ message }) => message.index)).toEqual([0]);
    expect(messagesByIndex.map(({ message }) => message.data.length)).toEqual([1]);
  });

  it('spreads chunks across the computed worker count', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 4 },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });

    await generateFileFingerprint(new File([new Uint8Array(3 * 1024 * 1024)], 'three-mb.bin'));

    expect(workerMockGlobal.__workerMockState?.instances).toHaveLength(2);
    expect(workerMockGlobal.__workerMockState?.fileMessages.map(({ message }) => message.index)).toEqual([
      0, 1,
    ]);
    expect(workerMockGlobal.__workerMockState?.fileMessages.map(({ message }) => message.data.length)).toEqual([
      2, 1,
    ]);
  });

  it('rejects and terminates workers when a worker reports an error', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 4 },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    workerMockGlobal.__workerMockConfig = {
      file: {
        1: {
          label: 'ERROR',
          data: 'partial md5 failed',
        },
      },
    };

    await expect(
      generateFileFingerprint(new File([new Uint8Array(3 * 1024 * 1024)], 'three-mb.bin')),
    ).rejects.toThrow('Worker 1 reported error: partial md5 failed');
    expect(workerMockGlobal.__workerMockState?.terminatedCount).toBeGreaterThanOrEqual(2);
  });

  it('rejects unexpected worker labels', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    workerMockGlobal.__workerMockConfig = {
      file: {
        0: {
          label: 'MYSTERY',
        },
      },
    };

    await expect(generateFileFingerprint(new File(['hello'], 'hello.txt'))).rejects.toThrow(
      'Unexpected message label received from worker 0: MYSTERY',
    );
  });

  it('rejects when a worker emits an error event', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    workerMockGlobal.__workerMockConfig = {
      file: {
        0: {
          onerror: { message: 'boom' },
        },
      },
    };

    await expect(generateFileFingerprint(new File(['hello'], 'hello.txt'))).rejects.toThrow(
      'Worker error',
    );
  });

  it('rejects when a sampled chunk cannot be read', async () => {
    const badBlob = {
      size: 1,
      arrayBuffer: async () => {
        throw new Error('cannot read chunk');
      },
    } as Blob;
    const file = {
      size: 1,
      slice: () => badBlob,
    } as File;

    await expect(generateFileFingerprint(file)).rejects.toThrow('Failed to read file chunks');
  });

  it('rejects when crypto digest fails while concatenating partial hashes', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: async () => {
            throw new Error('digest failed');
          },
        },
      },
    });

    await expect(generateFileFingerprint(new File(['hello'], 'hello.txt'))).rejects.toThrow(
      'Failed to concatenate hashes',
    );
  });
});
