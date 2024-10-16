import YoctoQueue from 'yocto-queue';
// 终于搞了一版无比满意的
enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}

export type UploadHelperOptions = {
  maxConcurrentTasks?: number; // 可选参数，默认并发数为 5
  maxRetries?: number; // 默认重试次数为 3
  retryDelay?: number; // 默认重试延迟 1 秒
};

export type Task<T> = {
  data: T; // 任务的数据
  index: number; // 任务的索引
};

export type AsyncFunction<T, R> = (props: { data: T; signal: AbortSignal }) => R | Promise<R>;

export class UploadHelper<T, R> {
  private queue: YoctoQueue<Task<T>> = new YoctoQueue<Task<T>>(); // 使用队列管理任务
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
    const { maxConcurrentTasks = 6, maxRetries = 3, retryDelay = 1000 } = options;
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

  private async runTask(task: Task<T>, retries = this.maxRetries): Promise<void> {
    this.activeCount++;
    const controller = new AbortController();
    this.currentRuningTasksMap.set(task.index, {
      controller,
      task,
    });

    try {
      const result = await this.taskExecutor({ data: task.data, signal: controller.signal });
      this.results[task.index] = result;
      this.progressCallback(++this.progress);
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        await this.runTask(task, retries - 1);
        return;
      } else {
        this.results[task.index] = error as Error;
        this.errorTasks.push(task);
      }
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
