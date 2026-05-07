import { generateChunksHash } from '../../../lib/apis/generateIdUtils/generateChunksHash';

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

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }
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
});
