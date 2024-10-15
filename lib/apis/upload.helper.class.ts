import YoctoQueue from 'yocto-queue';
// 终于搞了一版无比满意的
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

    return new Promise<(R | Error)[]>(resolve => {
      // 启动初始任务
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