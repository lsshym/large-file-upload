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
  maxRetries?: number;
  lowPerformance?: boolean;
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
  private currentRuningTasksMap: Map<number, { task: Task<T>; controller: AbortController; idleCallbackId?: number }> =
    new Map();
  private taskExecutor!: AsyncFunction<T, R>;
  private resolve!: (value: { results: (R | Error)[]; errorTasks: Task<T>[] }) => void;
  private maxRetries: number;
  private retryDelay: number = 1000;
  private runTaskMethod: (task: Task<T>) => Promise<void>;
  private progress = 0;
  private progressCallback: (index: number) => void = () => {};

  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const { maxConcurrentTasks = 4, maxRetries = 3, lowPerformance = false } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.runTaskMethod = lowPerformance ? this.runTaskWithIdleCallback : this.runTaskWithoutIdleCallback;
    tasksData.forEach((data, index) => {
      this.queue.enqueue({ data, index });
    });
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
    const result = await this.taskExecutor({ data: task.data, signal: controller.signal });
    this.results[task.index] = result;
    this.progressCallback(++this.progress);
    this.activeCount--;
    this.currentRuningTasksMap.delete(task.index);
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

  private async runTaskWithIdleCallback(task: Task<T>): Promise<void> {
    const controller = new AbortController();
    this.currentRuningTasksMap.set(task.index, { controller, task });
    this.activeCount++;

    await this.handleRetries(task, () =>
      new Promise<void>((resolve, reject) => {
        const idleCallbackId = requestIdleCallback(async () => {
          try {
            await this.executeTask(task, controller);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, { timeout: 2000 });

        this.currentRuningTasksMap.get(task.index)!.idleCallbackId = idleCallbackId;
      })
    );
  }

  private async runTaskWithoutIdleCallback(task: Task<T>): Promise<void> {
    const controller = new AbortController();
    this.currentRuningTasksMap.set(task.index, { controller, task });
    this.activeCount++;

    await this.handleRetries(task, () => this.executeTask(task, controller));
  }

  pause(): void {
    if (this.taskState !== TaskState.RUNNING) return;
    this.taskState = TaskState.PAUSED;
    this.currentRuningTasksMap.forEach(({ task, controller, idleCallbackId }) => {
      this.queue.enqueue(task);
      controller.abort();
      if (idleCallbackId !== undefined) cancelIdleCallback(idleCallbackId);
    });
    this.currentRuningTasksMap.clear();
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
    this.currentRuningTasksMap.forEach(({ controller, idleCallbackId }) => {
      controller.abort();
      if (idleCallbackId !== undefined) cancelIdleCallback(idleCallbackId);
    });
    this.queue.clear();
    this.currentRuningTasksMap.clear();
  }

  onProgressChange(callback: (index: number) => void): void {
    this.progressCallback = callback;
  }
}
