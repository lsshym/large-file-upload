import YoctoQueue from 'yocto-queue';

enum TaskState {
  RUNNING,
  PAUSED,
}

export type UploadHelperOptions = {
  maxConcurrentTasks?: number; // 可选参数，默认并发数为 5
  indexedDBName?: string;
};

export type Task<T> = {
  data: T; // 任务的数据
  index: number; // 任务的索引
};

export type AsyncFunction<T, R> = (props: { data: T; signal: AbortSignal }) => Promise<R>;

export class UploadHelper<T, R> {
  private queue: YoctoQueue<Task<T>> = new YoctoQueue<Task<T>>(); // 使用队列管理任务
  private maxConcurrentTasks: number;
  private results: (R | Error)[] = [];
  private activeCount = 0; // 当前正在运行的任务数
  private taskState: TaskState = TaskState.RUNNING;
  private currentRuningTasksMap: Map<
    number,
    {
      task: Task<T>;
      controller: AbortController;
    }
  > = new Map();
  private taskExecutor!: AsyncFunction<T, R>; // 任务执行函数，确保已定义
  private resolve!: (value: (R | Error)[]) => void; // 保存 resolve
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reject!: (reason?: any) => void; // 保存 reject
  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const { maxConcurrentTasks = 5, indexedDBName = '' } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;

    // 初始化任务队列
    tasksData.forEach((data, index) => {
      this.queue.enqueue({ data, index });
    });

    if (indexedDBName) {
      // 如果需要使用 IndexedDB，这里可以初始化 IndexedDBHelper
    }
  }

  exec(func: AsyncFunction<T, R>): Promise<(R | Error)[]> {
    this.taskExecutor = func;
    this.taskState = TaskState.RUNNING;

    return new Promise<(R | Error)[]>((resolve, reject) => {
      // 启动初始任务
      this.resolve = resolve;
      this.reject = reject;
      for (let i = 0; i < this.maxConcurrentTasks; i++) {
        this.next();
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private next(): void {
    if (this.taskState !== TaskState.RUNNING) {
      return;
    }
    // 如果所有任务都已完成，且没有正在运行的任务，结束执行
    if (this.queue.size === 0 && this.activeCount === 0) {
      this.resolve(this.results);
      return;
    }
    // 如果当前运行的任务数小于最大并发数，启动下一个任务
    if (this.activeCount < this.maxConcurrentTasks && this.queue.size > 0) {
      const task = this.queue.dequeue();
      if (task) {
        this.runTask(task).finally(() => {
          this.next();
        });
      }
    }
  }

  private async runTask(task: Task<T>): Promise<void> {
    this.activeCount++;
    const controller = new AbortController();
    this.currentRuningTasksMap.set(task.index, {
      controller,
      task,
    });
    try {
      const result = await this.taskExecutor({ data: task.data, signal: controller.signal });
      this.results[task.index] = result;
    } catch (error) {
      this.results[task.index] = error as Error;
    } finally {
      this.currentRuningTasksMap.delete(task.index);
      this.activeCount--;
    }
  }

  pause(): void {
    if (this.taskState !== TaskState.RUNNING) {
      return;
    }
    this.taskState = TaskState.PAUSED;
    this.currentRuningTasksMap.forEach(({ task, controller }) => {
      this.queue.enqueue(task);
      controller.abort();
    });
    this.currentRuningTasksMap.clear();
  }

  resume(): Promise<R[]> | void {
    if (this.taskState !== TaskState.PAUSED) {
      return;
    }
    this.taskState = TaskState.RUNNING;
    // 重新启动任务调度
    for (let i = 0; i < this.maxConcurrentTasks; i++) {
      this.next();
    }
  }
}

// enum TaskState {
//   RUNNING,
//   PAUSED,
// }

// export type UploadHelperOptions = {
//   maxConcurrentTasks?: number; // 可选参数
// };

// // 定义任务参数类型
// export type Task<T> = {
//   data: T; // 任务的数据
//   index: number; // 任务的索引
// };

// // 定义实际執行函数的类型
// export type AsyncFunction<T, R> = (props: { data: T; signal: AbortSignal }) => Promise<R>;

// export class UploadHelper<T, R> {
//   private queue = new YoctoQueue<Task<T>>();
//   private maxConcurrentTasks: number;
//   private results: (R | Error)[] = [];
//   private currentRunningCount = 0;
//   private taskState: TaskState = TaskState.RUNNING;
//   private _currentTaskIndex = 0; // 私有属性，用于记录当前任务索引
//   private controllers: Map<number, AbortController> = new Map();
//   private subscription: { unsubscribe: () => void } | null = null;
//   private indexChangeListener: ((index: number) => void) | null = null; // 任务索引变化监听器
//   private taskExecutor: AsyncFunction<T, R> | undefined = undefined; // 保存任务执行函数

//   private resolve: (value: R[] | PromiseLike<R[]>) => void;
//   constructor(tasks: T[], options: UploadHelperOptions = {}) {
//     const { maxConcurrentTasks = 5 } = options;
//     this.maxConcurrentTasks = maxConcurrentTasks;
//     tasks.forEach((data, index) => {
//       this.queue.enqueue({ data, index });
//     });
//   }

//   exec(func: AsyncFunction<T, R>): Promise<R[]> {
//     this.taskExecutor = func;
//     this.taskState = TaskState.RUNNING;
//     return new Promise<R[]>((resolve, reject) => {
//       for (let i = 0; i < this.maxConcurrentTasks; i++) {
//         this.resumeNext(resolve, reject);
//       }
//     });
//   }

//   private resumeNext(resolve: (value: R[]) => void, reject: (reason?: any) => void): void {
//     // 任务全部完成
//     if (this.queue.size === 0 && this.currentRunningCount === 0) {
//           if (this.queue.size === 0 && this.activeCount === 0) {
//             resolve(this.results);
//             return;
//           }
//       return;
//     }
//     if (this.currentRunningCount < this.maxConcurrentTasks && this.queue.size > 0) {
//       const { data, index } = this.queue.dequeue();
//       this.runTask(data, index);
//       this.currentRunningCount++;
//     }
//   }

//   private async runTask(data: T, index: number): void {
//     const controller = new AbortController();
//     this.taskExecutor({ data, signal: controller.signal })
//       .then(result => {
//         this.results[index] = result;
//       })
//       .catch(error => {
//         this.results[index] = error;
//       })
//       .finally(() => {
//         this.controllers.delete(index);
//         this.next();
//       });
//   }
//   private next() {
//     this.currentRunningCount--;
//     this.resumeNext();
//   }
// }
