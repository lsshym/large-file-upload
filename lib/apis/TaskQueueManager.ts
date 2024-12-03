/* eslint-disable @typescript-eslint/no-explicit-any */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFunction<T = any, R = any> = (props: {
  data: T;
  signal: AbortSignal;
}) => R | Promise<R>;

/**
 * `TaskQueueManager` class to manage and execute asynchronous task queues, supporting concurrency control, pausing, resuming, retries, and more.
 *
 * @template T The type of input task data.
 * @template R The type of the result returned after task execution.
 *
 * ### Example Usage:
 * 
 * ```typescript
 * const tasksData = []; // Replace with actual task data
 * const uploadHelper = new TaskQueueManager(tasksData, {
 *   maxConcurrentTasks: 5,
 * });
 * 
 * // Define task execution function
 * const taskExecutor: AsyncFunction<typeof tasksData[0], ResultType> = async ({ data, signal }) => {
 *   // Perform the async operation, e.g., uploading a file
 *   return await uploadFile(data, signal);
 * };
 * 
 * // Run the tasks
 * uploadHelper.run(taskExecutor).then(({ results, errorTasks }) => {
 *   // Handle results
 *   console.log('All tasks completed', results);
 *   if (errorTasks.length > 0) {
 *     console.log('Failed tasks', errorTasks);
 *   }
 * });
 * 
 * // Listen for progress change
 * uploadHelper.onProgressChange(progress => {
 *   console.log(`Progress: ${progress}/${tasksData.length}`);
 * });
 * 
 * // You can pause and resume tasks at any time
 * // uploadHelper.pause();
 * // uploadHelper.resume();
 * ```
 */
export class TaskQueueManager<T = any, R = any> {
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

  /**
   * Creates an instance of `TaskQueueManager` to manage a queue of asynchronous tasks with concurrency control and other options.
   * @param tasksData Array of input data for the tasks.
   * @param options Configuration options for the helper.
   */
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
    
    if (lowPriority) {
      if ('requestIdleCallback' in window) {
        this.runTaskMethod = this.runTaskWithIdleCallback;
      } else {
        this.maxConcurrentTasks = this.maxConcurrentTasks / 2;
        this.runTaskMethod = this.runTaskWithoutIdleCallback;
      }
    } else {
      this.runTaskMethod = this.runTaskWithoutIdleCallback;
    }

    const totalTasks = tasksData.length;
    for (let i = 0; i < totalTasks; i++) {
      this.queue.enqueue({ data: tasksData[i], index: i });
    }
  }

  /**
   * Start executing the task queue.
   * @param func The async function to execute each task.
   * @returns A promise containing the results and error tasks.
   */
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

  // Method using requestIdleCallback
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

  private async runTaskWithoutIdleCallback(task: Task<T>): Promise<void> {
    const controller = new AbortController();
    this.currentRunningTasksMap.set(task.index, { controller, task });
    this.activeCount++;

    await this.handleRetries(task, () => this.executeTask(task, controller));
  }

  /**
   * Pause the task execution.
   */
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

  /**
   * Resume task execution after being paused.
   */
  resume(): void {
    if (this.taskState !== TaskState.PAUSED) return;
    this.taskState = TaskState.RUNNING;
    for (let i = 0; i < this.maxConcurrentTasks; i++) this.next();
  }

  /**
   * Retry a list of tasks.
   * @param tasks List of tasks to retry.
   * @returns A promise containing the results and error tasks.
   */
  retryTasks(tasks: Task<T>[]): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    tasks.forEach(task => this.queue.enqueue(task));
    this.taskState = TaskState.RUNNING;
    return new Promise(resolve => {
      this.resolve = resolve;
      for (let i = 0; i < this.maxConcurrentTasks; i++) this.next();
    });
  }

  /**
   * Clear the task queue and stop all running tasks.
   */
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

  /**
   * Set a callback to listen for progress updates.
   * @param callback Callback function that receives the current progress.
   */
  onProgressChange(callback: (index: number) => void): void {
    this.progressCallback = callback;
  }
}