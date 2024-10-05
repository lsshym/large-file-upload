/* eslint-disable @typescript-eslint/no-explicit-any */
import { SimpleBehaviorSubject } from './simpleObservable';

type AsyncFunction<T = any> = (props: { signal: AbortSignal }) => Promise<T>;

export function uploadHelper<T = any>(
  functions: AsyncFunction<T>[],
  maxConcurrentTasks: number = 4,
  maxErrors: number = 10,
) {
  // 初始化任务队列和相关状态
  const queue: { fn: AsyncFunction<T>; index: number }[] = functions.map((fn, index) => ({ fn, index }));
  const currentRunningCount = new SimpleBehaviorSubject(0);
  const results: (T | Error)[] = [];
  const controllers: {
    [index: number]: { controller: AbortController; fn: AsyncFunction<T>; index: number };
  } = {};

  let isPaused = false;
  let errorCount = 0;
  let currentTaskIndex = 0;
  let indexChangeListener: (index: number) => void = () => {};

  function notifyIndexChange() {
    indexChangeListener(currentTaskIndex);
  }

  function setIndexChangeListener(listener: (index: number) => void) {
    indexChangeListener = listener;
  }

  function exec() {
    return new Promise<T[]>((resolve, reject) => {
      const processQueue = () => {
        if (isPaused || currentRunningCount.value >= maxConcurrentTasks) {
          return;
        }

        // 如果队列为空且没有正在运行的任务，表示所有任务完成
        if (queue.length === 0 && currentRunningCount.value === 0) {
          resolve(results as T[]);
          return;
        }

        // 如果错误数超限，停止所有任务并 reject
        if (errorCount > maxErrors) {
          reject(new Error('Error limit exceeded'));
          return;
        }

        // 开始处理任务
        while (!isPaused && currentRunningCount.value < maxConcurrentTasks && queue.length > 0) {
          const { fn, index } = queue.shift()!;
          const controller = new AbortController();
          controllers[index] = { controller, fn, index };
          currentRunningCount.next(currentRunningCount.value + 1);

          fn({ signal: controller.signal })
            .then(result => {
              results[index] = result;
            })
            .catch(error => {
              results[index] = error;
              errorCount++;
              if (errorCount > maxErrors) {
                reject(new Error('Error limit exceeded'));
              }
            })
            .finally(() => {
              currentRunningCount.next(currentRunningCount.value - 1);
              delete controllers[index];
              currentTaskIndex++;
              notifyIndexChange();
              processQueue();
            });
        }
      };
      processQueue();
    }).finally(() => {
      unsubscribe();
      // 清理控制器
      for (const key in controllers) {
        delete controllers[key];
      }
    });
  }

  function pause() {
    isPaused = true;
    // 中止所有正在执行的任务并将其放回队列
    Object.values(controllers).forEach(({ controller, fn, index }) => {
      controller.abort();
      queue.unshift({ fn, index });
    });
    // 清空控制器
    for (const key in controllers) {
      delete controllers[key];
    }
  }

  function resume() {
    if (isPaused) {
      isPaused = false;
      currentRunningCount.next(currentRunningCount.value);
    }
  }

  function cancelAll() {
    isPaused = true;
    // 中止所有正在执行的任务
    Object.values(controllers).forEach(({ controller }) => {
      controller.abort();
    });
    // 清空控制器和任务队列
    for (const key in controllers) {
      delete controllers[key];
    }
    queue.length = 0;
    // 重置当前运行计数
    currentRunningCount.next(0);
  }

  function unsubscribe() {
    // 如果有订阅 currentRunningCount 的监听器，可以在这里取消订阅
    // 例如，如果您有一个订阅变量：
    // if (subscription) {
    //   subscription.unsubscribe();
    //   subscription = null;
    // }
  }

  return {
    exec,
    setIndexChangeListener,
    pause,
    resume,
    cancelAll,
  };
}
