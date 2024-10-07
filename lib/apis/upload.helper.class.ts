import { SimpleBehaviorSubject } from './simpleObservable';

// 定义异步函数的类型，返回 Promise 类型
type AsyncFunction<T> = (props: { signal: AbortSignal }) => Promise<T>;

export class UploadHelper<T> {
  private queue: { fn: AsyncFunction<T>; index: number }[] = [];
  private maxConcurrentTasks: number;
  private results: (T | Error)[] = [];
  private currentRunningCount = new SimpleBehaviorSubject(0);
  private isPaused = false;
  private _currentTaskIndex = 0; // 私有属性，用于记录当前任务索引
  private controllers: {
    [index: number]: { fn: AsyncFunction<T>; controller: AbortController; index: number };
  } = {};
  private subscription: { unsubscribe: () => void } | null = null;
  private maxErrors: number; // 最大允许错误数
  private errorCount = 0; // 当前错误数
  private indexChangeListener: ((index: number) => void) | null = null; // 任务索引变化监听器

  constructor(
    functions: AsyncFunction<T>[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 4,
    maxErrors: number = 10, // 默认最大错误数为 10
  ) {
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxErrors = maxErrors;
  }

  // 执行任务队列
  exec(): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const processQueue = () => {
        if (this.isPaused || this.currentRunningCount.value >= this.maxConcurrentTasks) {
          return;
        }

        if (this.queue.length === 0 && this.currentRunningCount.value === 0) {
          resolve(this.results as T[]);
          return;
        }

        if (this.errorCount > this.maxErrors) {
          reject(new Error('Error limit exceeded'));
          return;
        }

        while (
          !this.isPaused &&
          this.currentRunningCount.value < this.maxConcurrentTasks &&
          this.queue.length > 0
        ) {
          const { fn, index } = this.queue.shift()!;
          const controller = new AbortController();
          this.controllers[index] = { controller, fn, index };
          this.currentRunningCount.next(this.currentRunningCount.value + 1);

          fn({ signal: controller.signal })
            .then(result => {
              this.results[index] = result;
            })
            .catch(error => {
              this.results[index] = error;
              this.errorCount++;
              if (this.errorCount > this.maxErrors) {
                reject(new Error('Error limit exceeded'));
              }
            })
            .finally(() => {
              this.currentRunningCount.next(this.currentRunningCount.value - 1);
              delete this.controllers[index];
              this._currentTaskIndex++;
              this.notifyIndexChange();
            });
        }
      };

      this.subscription = this.currentRunningCount.subscribe(() => {
        processQueue();
      });

      processQueue();
    }).finally(() => {
      this.unsubscribe();
      this.controllers = {};
    });
  }

  // 暂停任务
  pause() {
    this.isPaused = true;
    Object.values(this.controllers).forEach(({ controller, fn, index }) => {
      controller.abort();
      this.queue.unshift({ fn, index });
    });
    this.controllers = {};
  }

  // 恢复任务
  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentRunningCount.next(this.currentRunningCount.value);
    }
  }

  // 取消所有任务
  cancelAll() {
    this.isPaused = true;
    Object.values(this.controllers).forEach(({ controller }) => {
      controller.abort();
    });
    this.controllers = {};
    this.queue = [];
    this.currentRunningCount.next(0);
  }

  // 获取当前任务索引
  get currentTaskIndex(): number {
    return this._currentTaskIndex;
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
