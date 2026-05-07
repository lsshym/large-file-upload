import { webcrypto } from 'node:crypto';
import { generateFileFingerprint } from '../../../lib/apis/generateIdUtils/generateFileFingerprint';

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
});
