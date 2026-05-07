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
});
