// UploadHelper.test.ts
import { UploadHelper } from '../lib/apis/upload.helper.class';
// 在 UploadHelper.test.ts 顶部添加
jest.mock('yocto-queue', () => {
  return {
    default: class {
      private items: any[] = [];
      enqueue(item: any) {
        this.items.push(item);
      }
      dequeue() {
        return this.items.shift();
      }
      get size() {
        return this.items.length;
      }
      clear() {
        this.items = [];
      }
    },
  };
});

describe('UploadHelper', () => {
  it('should process tasks and return results', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData);

    const asyncFunction = jest.fn(async ({ data, }) => {
      return data * 2;
    });

    const { results, errorTasks } = await uploadHelper.run(asyncFunction);

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errorTasks).toHaveLength(0);
  });

  it('should limit the number of concurrent tasks', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const maxConcurrentTasks = 2;
    const uploadHelper = new UploadHelper<number, number>(tasksData, { maxConcurrentTasks });

    let concurrentTasks = 0;
    let maxConcurrentObserved = 0;

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      concurrentTasks++;
      if (concurrentTasks > maxConcurrentObserved) {
        maxConcurrentObserved = concurrentTasks;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      concurrentTasks--;
      return data * 2;
    });

    const { results, errorTasks } = await uploadHelper.run(asyncFunction);

    expect(maxConcurrentObserved).toBeLessThanOrEqual(maxConcurrentTasks);
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errorTasks).toHaveLength(0);
  });

  it('should retry failed tasks', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData, { maxRetries: 2 });

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      if (data === 3 && asyncFunction.mock.calls.length <= 2) {
        throw new Error('Task failed');
      }
      return data * 2;
    });

    const { results, errorTasks } = await uploadHelper.run(asyncFunction);

    expect(results[2]).toEqual(6);
    expect(errorTasks).toHaveLength(0);
  });

  it('should handle task failures after retries', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData, { maxRetries: 1 });

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      if (data === 3) {
        throw new Error('Task failed');
      }
      return data * 2;
    });

    const { results, errorTasks } = await uploadHelper.run(asyncFunction);

    expect(results[2]).toBeInstanceOf(Error);
    expect(errorTasks).toHaveLength(1);
    expect(errorTasks[0].data).toBe(3);
  });

  it('should pause and resume tasks', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData);

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return data * 2;
    });

    const runPromise = uploadHelper.run(asyncFunction);

    // Pause after some time
    setTimeout(() => {
      uploadHelper.pause();
    }, 150);

    // Resume after some more time
    setTimeout(() => {
      uploadHelper.resume();
    }, 300);

    const { results, errorTasks } = await runPromise;

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errorTasks).toHaveLength(0);
  });

  it('should call progress callback', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData);

    const progressCallback = jest.fn();

    uploadHelper.onProgressChange(progressCallback);

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return data * 2;
    });

    const { results, errorTasks } = await uploadHelper.run(asyncFunction);

    expect(progressCallback).toHaveBeenCalledTimes(5);
    expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errorTasks).toHaveLength(0);
  });

  it('should clear tasks', async () => {
    const tasksData = [1, 2, 3, 4, 5];
    const uploadHelper = new UploadHelper<number, number>(tasksData);

    const asyncFunction = jest.fn(async ({ data, signal }) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return data * 2;
    });

    const runPromise = uploadHelper.run(asyncFunction);

    // Clear tasks after some time
    setTimeout(() => {
      uploadHelper.clear();
    }, 150);

    const { results, errorTasks } = await runPromise;

    expect(uploadHelper['taskState']).toBe(2); // TaskState.COMPLETED
    expect(results).toEqual(expect.any(Array));
    expect(errorTasks).toHaveLength(0);
  });
});
