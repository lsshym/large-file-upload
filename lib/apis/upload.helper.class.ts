enum TaskState {
  RUNNING,
  PAUSED,
}

import { SimpleBehaviorSubject } from './simpleObservable';

// 定义异步函数的类型，返回 Promise 类型
type AsyncFunction<T> = (props: { signal: AbortSignal }) => Promise<T>;

export class UploadHelper<T> {
  private queue: { fn: AsyncFunction<T>; index: number }[] = [];
  private maxConcurrentTasks: number;
  private results: (T | Error)[] = [];
  private currentRunningCount = new SimpleBehaviorSubject(0);
  private taskState: TaskState = TaskState.RUNNING;
  private _currentTaskIndex = 0; // 私有属性，用于记录当前任务索引
  private controllers: Map<number, { controller: AbortController; fn: AsyncFunction<T> }> =
    new Map();
  private subscription: { unsubscribe: () => void } | null = null;

  private maxErrors: number; // 最大允许错误数
  private errorCount = 0; // 当前错误数
  private indexChangeListener: ((index: number) => void) | null = null; // 任务索引变化监听器
  private stopOnMaxErrors: boolean;

  constructor(
    functions: AsyncFunction<T>[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 4,
    maxErrors: number = 10, // 默认最大错误数为 10
    stopOnMaxErrors: boolean = true, // 是否在达到最大错误数后停止任务
  ) {
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxErrors = maxErrors;
    this.stopOnMaxErrors = stopOnMaxErrors;
  }

  // 执行任务队列
  exec(): Promise<T[]> {
    return new Promise(resolve => {
      this.subscription = this.currentRunningCount.subscribe(() => {
        this.processQueue();
        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          this.controllers.clear();
          this.unsubscribe();
          resolve(this.results as T[]);
        }
      });
    });
  }

  // 处理任务队列
  private processQueue(): void {
    if (
      this.taskState === TaskState.PAUSED ||
      this.currentRunningCount.value >= this.maxConcurrentTasks
    ) {
      return;
    }

    if (this.queue.length === 0 && this.currentRunningCount.value === 0) {
      return;
    }

    if (this.errorCount > this.maxErrors && this.stopOnMaxErrors) {
      this.cancelAll();
      return;
    }

    while (
      this.taskState === TaskState.RUNNING &&
      this.currentRunningCount.value < this.maxConcurrentTasks &&
      this.queue.length > 0
    ) {
      const { fn, index } = this.queue.shift()!;
      const controller = new AbortController();
      this.controllers.set(index, { controller, fn });
      this.currentRunningCount.next(this.currentRunningCount.value + 1);
      this.runTask(fn, index, controller);
    }
  }

  // 运行单个任务
  private runTask(fn: AsyncFunction<T>, index: number, controller: AbortController): void {
    fn({ signal: controller.signal })
      .then(result => {
        this.results[index] = result;
      })
      .catch(error => {
        this.results[index] = error;
        this.errorCount++;
        if (this.errorCount > this.maxErrors && this.stopOnMaxErrors) {
          this.cancelAll();
        }
      })
      .finally(() => {
        this.currentRunningCount.next(this.currentRunningCount.value - 1);
        this.controllers.delete(index);
        this._currentTaskIndex++;
        this.notifyIndexChange();
      });
  }

  // 暂停任务
  pause() {
    this.taskState = TaskState.PAUSED;
    this.controllers.forEach(({ controller, fn }, index) => {
      controller.abort();
      this.queue.push({ fn, index });
    });
    this.controllers.clear();
  }

  // 恢复任务
  resume() {
    if (this.taskState === TaskState.PAUSED) {
      this.taskState = TaskState.RUNNING;
      this.processQueue();
    }
  }

  // 取消所有任务
  cancelAll() {
    this.controllers.forEach(({ controller }) => {
      controller.abort();
    });
    this.controllers.clear();
    this.queue = [];
    this.currentRunningCount.next(0);
  }

  // 设置任务索引变化的监听器
  setIndexChangeListener(listener: (index: number) => void) {
    this.indexChangeListener = listener;
  }

  // 通知任务索引变化
  private notifyIndexChange() {
    if (this.indexChangeListener) {
      this.indexChangeListener(this._currentTaskIndex);
    }
  }

  // 取消订阅
  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
