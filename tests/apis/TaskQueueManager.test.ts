import { TaskQueueManager } from '../../lib/apis/TaskQueueManager';

function withTimeout<T>(promise: Promise<T>, timeout = 50): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>(resolve => {
      setTimeout(() => resolve('timeout'), timeout);
    }),
  ]);
}

describe('TaskQueueManager', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalRequestIdleCallback = Object.getOwnPropertyDescriptor(globalThis, 'requestIdleCallback');
  const originalCancelIdleCallback = Object.getOwnPropertyDescriptor(globalThis, 'cancelIdleCallback');

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();

    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }

    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      delete (globalThis as { window?: Window }).window;
    }

    if (originalRequestIdleCallback) {
      Object.defineProperty(globalThis, 'requestIdleCallback', originalRequestIdleCallback);
    } else {
      delete globalThis.requestIdleCallback;
    }

    if (originalCancelIdleCallback) {
      Object.defineProperty(globalThis, 'cancelIdleCallback', originalCancelIdleCallback);
    } else {
      delete globalThis.cancelIdleCallback;
    }
  });

  it('runs tasks in input order and stores results by original index', async () => {
    const manager = new TaskQueueManager(['slow', 'fast', 'middle'], {
      maxConcurrentTasks: 3,
    });

    const { results, errorTasks } = await manager.run(
      ({ data }) =>
        new Promise<string>(resolve => {
          const delay = data === 'slow' ? 20 : data === 'middle' ? 10 : 0;
          setTimeout(() => resolve(`uploaded-${data}`), delay);
        }),
    );

    expect(errorTasks).toEqual([]);
    expect(results).toEqual(['uploaded-slow', 'uploaded-fast', 'uploaded-middle']);
  });

  it('does not exceed the configured concurrency limit', async () => {
    const manager = new TaskQueueManager([1, 2, 3, 4, 5], {
      maxConcurrentTasks: 2,
    });
    let active = 0;
    let maxActive = 0;

    const { results } = await manager.run(
      ({ data }) =>
        new Promise<number>(resolve => {
          active++;
          maxActive = Math.max(maxActive, active);
          setTimeout(() => {
            active--;
            resolve(data);
          }, 5);
        }),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses half of navigator.hardwareConcurrency as the default concurrency', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 6 },
    });
    const manager = new TaskQueueManager([1, 2, 3, 4, 5, 6]);
    let active = 0;
    let maxActive = 0;

    await manager.run(
      ({ data }) =>
        new Promise<number>(resolve => {
          active++;
          maxActive = Math.max(maxActive, active);
          setTimeout(() => {
            active--;
            resolve(data);
          }, 5);
        }),
    );

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('falls back to four default concurrent tasks when hardwareConcurrency is invalid', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 1 },
    });
    const manager = new TaskQueueManager([1, 2, 3, 4, 5, 6]);
    let active = 0;
    let maxActive = 0;

    await manager.run(
      ({ data }) =>
        new Promise<number>(resolve => {
          active++;
          maxActive = Math.max(maxActive, active);
          setTimeout(() => {
            active--;
            resolve(data);
          }, 5);
        }),
    );

    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('normalizes invalid configured concurrency so tasks still run', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 0,
    });

    const result = await withTimeout(manager.run(async ({ data }) => data));

    expect(result).not.toBe('timeout');
    if (result === 'timeout') return;

    expect(result.results).toEqual(['chunk-a']);
  });

  it('normalizes non-finite configured concurrency so tasks still run', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: Number.NaN,
    });

    const result = await withTimeout(manager.run(async ({ data }) => data));

    expect(result).not.toBe('timeout');
    if (result === 'timeout') return;

    expect(result.results).toEqual(['chunk-a']);
  });

  it('emits progress once per successful task', async () => {
    const manager = new TaskQueueManager(['chunk-a', 'chunk-b', 'chunk-c'], {
      maxConcurrentTasks: 2,
    });
    const progressCallback = jest.fn();
    manager.onProgressChange(progressCallback);

    await manager.run(async ({ data }) => data);

    expect(progressCallback).toHaveBeenCalledTimes(3);
    expect(progressCallback.mock.calls.map(call => call[0])).toEqual([1, 2, 3]);
  });

  it('does not call progress for failed tasks', async () => {
    const manager = new TaskQueueManager(['chunk-a', 'chunk-b'], {
      maxConcurrentTasks: 1,
      maxRetries: 0,
      retryDelay: 0,
    });
    const progressCallback = jest.fn();
    manager.onProgressChange(progressCallback);

    await manager.run(async ({ data }) => {
      if (data === 'chunk-a') {
        throw new Error('upload failed');
      }

      return data;
    });

    expect(progressCallback).toHaveBeenCalledTimes(1);
  });

  it('retries a failing task before recording an error', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      maxRetries: 2,
      retryDelay: 0,
    });
    let attempts = 0;

    const result = await manager.run(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('temporary failure');
      }

      return 'uploaded';
    });

    expect(result.errorTasks).toEqual([]);
    expect(result.results).toEqual(['uploaded']);
    expect(attempts).toBe(2);
  });

  it('waits retryDelay before retrying a failed task', async () => {
    jest.useFakeTimers();
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      maxRetries: 2,
      retryDelay: 100,
    });
    let attempts = 0;

    const runPromise = manager.run(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('temporary failure');
      }

      return 'uploaded';
    });

    await Promise.resolve();
    expect(attempts).toBe(1);

    await jest.advanceTimersByTimeAsync(99);
    expect(attempts).toBe(1);

    await jest.advanceTimersByTimeAsync(1);
    await expect(runPromise).resolves.toMatchObject({
      results: ['uploaded'],
      errorTasks: [],
    });
    expect(attempts).toBe(2);
  });

  it('settles with failed tasks when retries are exhausted', async () => {
    const manager = new TaskQueueManager(['chunk-a', 'chunk-b'], {
      maxConcurrentTasks: 2,
      maxRetries: 0,
      retryDelay: 0,
    });

    const result = await withTimeout(
      manager.run(async () => {
        throw new Error('upload failed');
      }),
    );

    expect(result).not.toBe('timeout');
    if (result === 'timeout') return;

    expect(result.errorTasks).toHaveLength(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toBeInstanceOf(Error);
    expect(result.results[1]).toBeInstanceOf(Error);
  });

  it('does not retry when maxRetries is exhausted after the first failure', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      maxRetries: 0,
      retryDelay: 0,
    });
    const executor = jest.fn(async () => {
      throw new Error('permanent failure');
    });

    const result = await manager.run(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.errorTasks).toEqual([{ data: 'chunk-a', index: 0 }]);
  });

  it('settles the running promise when cleared', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      retryDelay: 0,
    });

    const runPromise = manager.run(
      ({ signal }) =>
        new Promise<string>((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
          setTimeout(() => resolve('uploaded'), 100);
        }),
    );

    manager.clear();

    const result = await withTimeout(runPromise);

    expect(result).not.toBe('timeout');
    if (result === 'timeout') return;

    expect(result.errorTasks).toEqual([]);
    expect(result.results).toEqual([]);
  });

  it('ignores results from tasks that finish after pause', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      retryDelay: 0,
    });

    const progressCallback = jest.fn();
    manager.onProgressChange(progressCallback);
    manager.run(
      () =>
        new Promise<string>(resolve => {
          setTimeout(() => resolve('late result'), 0);
        }),
    );

    manager.pause();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(progressCallback).not.toHaveBeenCalled();
  });

  it('resumes paused queued tasks with a fresh AbortSignal', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      retryDelay: 0,
    });
    const signals: AbortSignal[] = [];

    const runPromise = manager.run(
      ({ signal }) =>
        new Promise<string>(resolve => {
          signals.push(signal);
          setTimeout(() => resolve('uploaded'), 10);
        }),
    );

    manager.pause();
    expect(signals[0].aborted).toBe(true);
    manager.resume();

    const result = await runPromise;

    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
    expect(result.results).toEqual(['uploaded']);
  });

  it('pause is a no-op after completion', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
    });

    const completed = await manager.run(async ({ data }) => data);
    manager.pause();

    expect(completed.results).toEqual(['chunk-a']);
    expect(completed.errorTasks).toEqual([]);
  });

  it('clears old errors when failed tasks are retried successfully', async () => {
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      maxRetries: 0,
      retryDelay: 0,
    });

    let attempts = 0;
    const failedRun = await manager.run(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('upload failed');
      }

      return 'uploaded';
    });

    expect(failedRun.errorTasks).toHaveLength(1);

    const retryRun = await manager.retryTasks(failedRun.errorTasks);

    expect(retryRun.errorTasks).toEqual([]);
    expect(retryRun.results[0]).toBe('uploaded');
    expect(attempts).toBe(2);
  });

  it('preserves unrelated errors while retrying selected failed tasks', async () => {
    const manager = new TaskQueueManager(['chunk-a', 'chunk-b'], {
      maxConcurrentTasks: 2,
      maxRetries: 0,
      retryDelay: 0,
    });
    const attemptsByChunk = new Map<string, number>();

    const failedRun = await manager.run(async ({ data }) => {
      attemptsByChunk.set(data, (attemptsByChunk.get(data) || 0) + 1);
      if (data === 'chunk-a' && attemptsByChunk.get(data)! > 1) {
        return 'uploaded-chunk-a';
      }

      throw new Error(`upload failed: ${data}`);
    });

    const retryRun = await manager.retryTasks([failedRun.errorTasks.find(task => task.data === 'chunk-a')!]);

    expect(retryRun.errorTasks).toEqual([failedRun.errorTasks.find(task => task.data === 'chunk-b')]);
    expect(retryRun.results[0]).toBe('uploaded-chunk-a');
    expect(retryRun.results[1]).toBeInstanceOf(Error);
  });

  it('runs low-priority tasks with requestIdleCallback when available', async () => {
    const requestIdleCallback = jest.fn((callback: () => void) => {
      setTimeout(callback, 0);
      return 123;
    });
    const cancelIdleCallback = jest.fn();
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: cancelIdleCallback,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { requestIdleCallback },
    });
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      lowPriority: true,
    });

    const result = await manager.run(async ({ data }) => data);

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    expect(cancelIdleCallback).not.toHaveBeenCalled();
    expect(result.results).toEqual(['chunk-a']);
  });

  it('cancels scheduled idle callbacks when paused', async () => {
    const requestIdleCallback = jest.fn(() => 456);
    const cancelIdleCallback = jest.fn();
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: cancelIdleCallback,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { requestIdleCallback },
    });
    const manager = new TaskQueueManager(['chunk-a'], {
      maxConcurrentTasks: 1,
      lowPriority: true,
    });

    manager.run(async ({ data }) => data);
    manager.pause();

    expect(cancelIdleCallback).toHaveBeenCalledWith(456);
  });

  it('halves low-priority concurrency when requestIdleCallback is unavailable', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    const manager = new TaskQueueManager([1, 2, 3, 4], {
      maxConcurrentTasks: 4,
      lowPriority: true,
    });
    let active = 0;
    let maxActive = 0;

    await manager.run(
      ({ data }) =>
        new Promise<number>(resolve => {
          active++;
          maxActive = Math.max(maxActive, active);
          setTimeout(() => {
            active--;
            resolve(data);
          }, 5);
        }),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(1);
  });
});
