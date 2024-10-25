import YoctoQueue from 'yocto-queue';
// 终于搞了一版无比满意的
enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}

export type UploadHelperOptions = {
  maxConcurrentTasks?: number;
  maxRetries?: number;
  retryDelay?: number;
};

export type Task<T> = {
  data: T;
  index: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFunction<T = any, R = any> = (props: {
  data: T;
  signal: AbortSignal;
}) => R | Promise<R>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class UploadHelper<T = any, R = any> {
  private queue: YoctoQueue<Task<T>> = new YoctoQueue<Task<T>>();
  private maxConcurrentTasks: number;
  private results: (R | Error)[] = [];
  private errorTasks: Task<T>[] = [];
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
  private resolve!: (value: { results: (R | Error)[]; errorTasks: Task<T>[] }) => void; // 保存 resolve
  private maxRetries: number;
  private retryDelay: number;
  // 进度条
  private progress = 0; // 当前任务的索引
  private progressCallback: (index: number) => void = () => {};
  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const { maxConcurrentTasks = 4, maxRetries = 3, retryDelay = 1000 } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
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
    if (this.taskState !== TaskState.RUNNING) {
      return;
    }
    if (this.queue.size === 0 && this.activeCount === 0) {
      this.taskState = TaskState.COMPLETED;
      this.resolve({
        results: this.results,
        errorTasks: this.errorTasks,
      });
      return;
    }
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
    let retries = this.maxRetries; // 设置初始重试次数
    this.activeCount++;
    const controller = new AbortController();
    this.currentRuningTasksMap.set(task.index, {
      controller,
      task,
    });

    while (retries >= 0) {
      try {
        const result = await this.taskExecutor({ data: task.data, signal: controller.signal });
        this.results[task.index] = result;
        this.progressCallback(++this.progress);
        break;
      } catch (error) {
        if (this.taskState !== TaskState.RUNNING) {
          return;
        }
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return;
        } else {
          this.results[task.index] = error as Error;
          this.errorTasks.push(task);
        }
      }
      retries--; //
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

  resume(): void {
    if (this.taskState !== TaskState.PAUSED) {
      return;
    }
    this.taskState = TaskState.RUNNING;
    for (let i = 0; i < this.maxConcurrentTasks; i++) {
      this.next();
    }
  }
  retryTasks(tasks: Task<T>[]): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    tasks.forEach(task => {
      this.queue.enqueue(task);
    });
    this.taskState = TaskState.RUNNING;
    return new Promise(resolve => {
      this.resolve = resolve;
      for (let i = 0; i < this.maxConcurrentTasks; i++) {
        this.next();
      }
    });
  }
  clear(): void {
    this.taskState = TaskState.COMPLETED;
    this.currentRuningTasksMap.forEach(({ controller }) => {
      controller.abort();
    });
    this.queue.clear();
    this.currentRuningTasksMap.clear();
  }
  onProgressChange(callback: (index: number) => void): void {
    this.progressCallback = callback;
  }
}
