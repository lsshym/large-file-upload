/* eslint-disable @typescript-eslint/no-explicit-any */
// 终于搞了一版无比满意的

import YoctoQueue from 'yocto-queue';
enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}

export type UploadHelperOptions = {
  maxConcurrentTasks?: number;
  lowPriority?: boolean;
  maxRetries?: number;
  retryDelay?: number;
};

export type Task<T> = {
  data: T;
  index: number;
};

export type AsyncFunction<T = any, R = any> = (props: {
  data: T;
  signal: AbortSignal;
}) => R | Promise<R>;

export class UploadHelper<T = any, R = any> {
  private queue: YoctoQueue<Task<T>> = new YoctoQueue<Task<T>>();
  private maxConcurrentTasks: number;
  private results: (R | Error)[] = [];
  private errorTasks: Task<T>[] = [];
  private activeCount = 0;
  private taskState: TaskState = TaskState.RUNNING;
  private currentRunningTasksMap: Map<
    number,
    { task: Task<T>; controller: AbortController; idleCallbackId?: number }
  > = new Map();
  private taskExecutor!: AsyncFunction<T, R>;
  private resolve!: (value: { results: (R | Error)[]; errorTasks: Task<T>[] }) => void;
  private maxRetries: number;
  private retryDelay: number;
  private runTaskMethod: (task: Task<T>) => Promise<void>;
  private progress = 0;
  private progressCallback: (index: number) => void = () => {};
  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const {
      maxConcurrentTasks = (navigator?.hardwareConcurrency / 2) | 4,
      maxRetries = 3,
      retryDelay = 1000,
      lowPriority = false,
    } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    if (lowPriority && 'requestIdleCallback' in window) {
      this.runTaskMethod = this.runTaskWithIdleCallback
    } else {
      this.runTaskMethod = this.runTaskWithoutIdleCallback;
    }
   ;
    const totalTasks = tasksData.length;
    for (let i = 0; i < totalTasks; i++) {
      this.queue.enqueue({ data: tasksData[i], index: i });
    }
  }

  run(func: AsyncFunction<T, R>): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    this.taskExecutor = func;
    this.taskState = TaskState.RUNNING;

    return new Promise(resolve => {
      this.resolve = resolve;
      for (let i = 0; i < this.maxConcurrentTasks; i++) {
        this.next();
      }
    });
  }

  private next(): void {
    if (this.taskState !== TaskState.RUNNING) return;

    if (this.queue.size === 0 && this.activeCount === 0) {
      this.taskState = TaskState.COMPLETED;
      this.resolve({ results: this.results, errorTasks: this.errorTasks });
      return;
    }
    if (this.activeCount < this.maxConcurrentTasks && this.queue.size > 0) {
      const task = this.queue.dequeue();
      if (task) {
        this.runTaskMethod(task).finally(() => this.next());
      }
    }
  }

  private async executeTask(task: Task<T>, controller: AbortController): Promise<void> {
    const result = await this.taskExecutor({ data: task?.data, signal: controller?.signal });
    this.results[task.index] = result;
    this.progressCallback(++this.progress);
    this.activeCount--;
    this.currentRunningTasksMap.delete(task.index);
  }

  private async handleRetries(task: Task<T>, retryFn: () => Promise<void>): Promise<void> {
    let retries = this.maxRetries;
    while (retries >= 0) {
      try {
        await retryFn();
        break;
      } catch (error) {
        retries--;
        if (this.taskState !== TaskState.RUNNING) return;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          this.results[task.index] = error as Error;
          this.errorTasks.push(task);
        }
      }
    }
  }

  // 使用 requestIdleCallback 的方法
  private async runTaskWithIdleCallback(task: Task<T>): Promise<void> {
    const controller = new AbortController();
    this.currentRunningTasksMap.set(task.index, { controller, task });
    this.activeCount++;

    await this.handleRetries(
      task,
      () =>
        new Promise<void>((resolve, reject) => {
          const idleCallbackId = requestIdleCallback(
            async () => {
              try {
                await this.executeTask(task, controller);
                resolve();
              } catch (error) {
                reject(error);
              }
            },
            { timeout: 2000 },
          );
          this.currentRunningTasksMap.get(task.index)!.idleCallbackId = idleCallbackId;
        }),
    );
  }

  // TODO: 待完善, 部分浏览器暂不支持，这个问题暂时无解
  // private async runTaskWithIdleCallbackUsingMessageChannel(task: Task<T>): Promise<void> {
  //   const controller = new AbortController();
  //   this.currentRunningTasksMap.set(task.index, { controller, task });
  //   this.activeCount++;

  //   await this.handleRetries(
  //     task,
  //     () =>
  //       new Promise<void>((resolve, reject) => {
  //         const channel = new MessageChannel();

  //         // 设置超时定时器，2秒后强制执行
  //         const idleCallbackId = window.setTimeout(() => {
  //           // 如果任务尚未执行，则强制执行
  //           channel.port1.onmessage = null; // 防止重复执行
  //           try {
  //             this.executeTask(task, controller).then(resolve).catch(reject);
  //           } catch (error) {
  //             reject(error);
  //           }
  //         }, 2000);

  //         channel.port1.onmessage = () => {
  //           clearTimeout(idleCallbackId);
  //           try {
  //             this.executeTask(task, controller).then(resolve).catch(reject);
  //           } catch (error) {
  //             reject(error);
  //           }
  //         };

  //         // 发送消息，触发 onmessage，在微任务队列中执行
  //         channel.port2.postMessage(undefined);

  //         // 记录 timeoutId，以便在需要时清理
  //         this.currentRunningTasksMap.get(task.index)!.idleCallbackId = idleCallbackId;
  //       }),
  //   );
  // }

  private async runTaskWithoutIdleCallback(task: Task<T>): Promise<void> {
    const controller = new AbortController();
    this.currentRunningTasksMap.set(task.index, { controller, task });
    this.activeCount++;

    await this.handleRetries(task, () => this.executeTask(task, controller));
  }

  pause(): void {
    if (this.taskState !== TaskState.RUNNING) return;
    this.taskState = TaskState.PAUSED;
    this.activeCount = 0;
    this.currentRunningTasksMap.forEach(({ task, controller, idleCallbackId }) => {
      this.queue.enqueue(task);
      controller.abort();
      if (idleCallbackId !== undefined) cancelIdleCallback(idleCallbackId);
    });
    this.currentRunningTasksMap.clear();
  }

  resume(): void {
    if (this.taskState !== TaskState.PAUSED) return;
    this.taskState = TaskState.RUNNING;
    for (let i = 0; i < this.maxConcurrentTasks; i++) this.next();
  }

  retryTasks(tasks: Task<T>[]): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    tasks.forEach(task => this.queue.enqueue(task));
    this.taskState = TaskState.RUNNING;
    return new Promise(resolve => {
      this.resolve = resolve;
      for (let i = 0; i < this.maxConcurrentTasks; i++) this.next();
    });
  }

  clear(): void {
    this.taskState = TaskState.COMPLETED;
    this.activeCount = 0;
    this.currentRunningTasksMap.forEach(({ controller, idleCallbackId }) => {
      controller.abort();
      if (idleCallbackId !== undefined) cancelIdleCallback(idleCallbackId);
    });
    this.queue.clear();
    this.currentRunningTasksMap.clear();
  }

  onProgressChange(callback: (index: number) => void): void {
    this.progressCallback = callback;
  }
}
