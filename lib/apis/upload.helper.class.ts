enum TaskState {
  RUNNING,
  PAUSED,
}

export type UploadHelperOptions = {
  maxConcurrentTasks?: number; // 可选参数
  maxErrors?: number; // 默认最大错误数为 10
  stopOnMaxErrors?: boolean; // 是否在达到最大错误数后停止任务
  indexedDBName?: string;
};

import { IndexedDBHelper } from './indexdDB.helper';
import { SimpleBehaviorSubject } from './simpleObservable';

// 定义任务参数类型
export type Task<T> = {
  data: T; // 任务的数据
  index: number; // 任务的索引
};

// 定义实际執行函数的类型
export type AsyncFunction<T, R> = (props: { data: T; signal: AbortSignal }) => Promise<R>;

export class UploadHelper<T, R> {
  private queue: Task<T>[] = [];
  private maxConcurrentTasks: number;
  private results: (R | Error)[] = [];
  private currentRunningCount = new SimpleBehaviorSubject(0);
  private taskState: TaskState = TaskState.RUNNING;
  private _currentTaskIndex = 0; // 私有属性，用于记录当前任务索引
  private controllers: Map<number, AbortController> = new Map();
  private subscription: { unsubscribe: () => void } | null = null;

  private maxErrors: number; // 最大允许错误数
  private errorCount = 0; // 当前错误数
  private indexChangeListener: ((index: number) => void) | null = null; // 任务索引变化监听器
  private stopOnMaxErrors: boolean;
  private taskExecutor: AsyncFunction<T, R> | null = null; // 保存任务执行函数
  private indexedDBName: string = '';
  private indexedDBHelper: IndexedDBHelper<{ index: number }> | null = null;
  constructor(tasks: T[], options: UploadHelperOptions = {}) {
    const {
      maxConcurrentTasks = 5,
      maxErrors = 10,
      stopOnMaxErrors = true,
      indexedDBName = '',
    } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxErrors = maxErrors;
    this.stopOnMaxErrors = stopOnMaxErrors;
    this.indexedDBName = indexedDBName;
    if (this.indexedDBName) {
      this.indexedDBHelper = new IndexedDBHelper(this.indexedDBName, 'upload');
      this.indexedDBHelper.clear();
      this.queue = tasks.map((data, index) => {
        if (this.indexedDBHelper) {
          this.indexedDBHelper.add({ index });
        }
        return { data, index };
      });
    } else {
      this.queue = tasks.map((data, index) => {
        return { data, index };
      });
    }
  }

  exec(func: AsyncFunction<T, R>): Promise<R[]> {
    this.taskExecutor = func;
    return new Promise((resolve, reject) => {
      this.subscription = this.currentRunningCount.subscribe(() => {
        this.processQueue();
        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          if (this.errorCount > this.maxErrors && this.stopOnMaxErrors) {
            reject(new Error('Max error limit reached'));
          } else {
            resolve(this.results as R[]);
            if (this.indexedDBName) {
              IndexedDBHelper.deleteDatabase(this.indexedDBName);
            }
          }
          this.controllers.clear();
          this.unsubscribe();
        }
      });
    });
  }

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
      const { data, index } = this.queue.shift()!;
      const controller = new AbortController();
      this.controllers.set(index, controller);
      this.currentRunningCount.next(this.currentRunningCount.value + 1);
      if (this.taskExecutor) {
        this.runTask(data, this.taskExecutor, index, controller);
      }
    }
  }

  private runTask(
    data: T,
    func: AsyncFunction<T, R>,
    index: number,
    controller: AbortController,
  ): void {
    func({ data, signal: controller.signal })
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
        this.indexedDBHelper?.delete(index);
      });
  }

  // 暂停任务
  pause() {
    this.taskState = TaskState.PAUSED;
    this.controllers.forEach((controller, index) => {
      controller.abort();
      // 将中断的任务重新加入队列
      const queuedTask = this.queue.find(q => q.index === index);
      if (!queuedTask) {
        const taskData = this.results[index];
        if (taskData instanceof Error) {
          this.queue.push({ data: taskData as T, index });
        }
      }
    });
    this.controllers.clear();
  }

  resume() {
    if (this.taskState === TaskState.PAUSED && this.taskExecutor) {
      this.taskState = TaskState.RUNNING;
      this.processQueue();
    }
  }

  cancelAll() {
    this.controllers.forEach(controller => {
      controller.abort();
    });
    this.controllers.clear();
    this.queue = [];
    IndexedDBHelper.deleteDatabase(this.indexedDBName);
    this.currentRunningCount.next(0);
  }

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
  static getDataByDBName<T>(indexedDBName: string): Promise<T[]> {
    return IndexedDBHelper.getDataByDBName<T>(indexedDBName, 'upload');
  }
  static deleteDataByDBName(indexedDBName: string): Promise<void> {
    return IndexedDBHelper.deleteDatabase(indexedDBName);
  }
}
