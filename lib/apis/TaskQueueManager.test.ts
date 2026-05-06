import { TaskQueueManager } from './TaskQueueManager';

function withTimeout<T>(promise: Promise<T>, timeout = 50): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>(resolve => {
      setTimeout(() => resolve('timeout'), timeout);
    }),
  ]);
}

describe('TaskQueueManager', () => {
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
});
