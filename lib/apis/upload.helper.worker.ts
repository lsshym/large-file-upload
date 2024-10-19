import YoctoQueue from 'yocto-queue';

import RequestWorker from './workers.api/request.worker.ts?worker';
enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}
export enum RequestWorkerLabelsEnum {
  INIT = 'INIT',
  INITED = 'INITED',
  DOING = 'DOING',
  DONE = 'DONE',
  ERROR = 'ERROR',
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

export type AsyncFunction<T, R> = (props: { data: T; signal: AbortSignal }) => R | Promise<R>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class UploadWorkerHelper<T = any, R = any> {
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
    const { maxConcurrentTasks = 5, maxRetries = 3, retryDelay = 1000 } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    // 1 还是用链表，只有在执行的时候，把任务发送到worker，这里只管发送，具体任务让worker自己去分配
    tasksData.forEach((data, index) => {
      this.queue.enqueue({ data, index });
    });
  }

  run(func: AsyncFunction<T, R>): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    // this.taskExecutor = func;
    this.taskState = TaskState.RUNNING;

    return new Promise(resolve => {
      this.resolve = resolve;
      for (let i = 0; i < this.maxConcurrentTasks; i++) {
        const worker = new RequestWorker();
        worker.postMessage({
          label: RequestWorkerLabelsEnum.INIT,
          data: func.toString(),
        });
        worker.onmessage = event => {
          const { label } = event.data;
          // const { chunk, ...other } = data;
          try {
            switch (label) {
              case RequestWorkerLabelsEnum.INITED: {
                // 初始化完成，开始执行任务
                this.next(worker);
                break;
              }
              // 可以添加其他 case
              default:
                throw new Error(`Unhandled message label: ${label}`);
            }
          } catch (error) {
            throw new Error(`Unhandled message label: ${error}`);
          }
        };
      }
      // worker初始化，在哪里管理worker
      // 如果在让workerpool自动管理，这里只需要向workerpool发送任务,并发数让worker自己控制
      //
      // 或者这里新建几个worker，然后按照老的思路，每个worker持续处理任务
    });
  }

  private next(worker): void {
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
        this.runTask(task, worker).finally(() => {
          this.next(worker);
        });
      }
    }
  }

  private async runTask(task: Task<T>, worker, retries = this.maxRetries): Promise<void> {
    this.activeCount++;
    // const controller = new AbortController();
    // this.currentRuningTasksMap.set(task.index, {
    //   controller,
    //   task,
    // });

    // try {
    //   const result = await this.taskExecutor({ data: task.data, signal: controller.signal });
    //   this.results[task.index] = result;
    //   this.progressCallback(++this.progress);
    // } catch (error) {
    //   if (retries > 0) {
    //     await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    //     await this.runTask(task, retries - 1);
    //     return;
    //   } else {
    //     this.results[task.index] = error as Error;
    //     this.errorTasks.push(task);
    //   }
    // } finally {
    //   this.currentRuningTasksMap.delete(task.index);
    //   this.activeCount--;
    // }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { chunk, ...other } = task.data as any;
    const arrayBuffer = await chunk.arrayBuffer();
    worker.postMessage(
      {
        label: RequestWorkerLabelsEnum.DOING,
        data: other,
        arrayBuffer,
        index: task.index,
      },
      // [arrayBuffer],
    );
  }

  // pause(): void {
  //   if (this.taskState !== TaskState.RUNNING) {
  //     return;
  //   }
  //   this.taskState = TaskState.PAUSED;
  //   this.currentRuningTasksMap.forEach(({ task, controller }) => {
  //     this.queue.enqueue(task);
  //     controller.abort();
  //   });
  //   this.currentRuningTasksMap.clear();
  // }

  // resume(): void {
  //   if (this.taskState !== TaskState.PAUSED) {
  //     return;
  //   }
  //   this.taskState = TaskState.RUNNING;
  //   for (let i = 0; i < this.maxConcurrentTasks; i++) {
  //     this.next();
  //   }
  // }
  // retryTasks(tasks: Task<T>[]): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
  //   tasks.forEach(task => {
  //     this.queue.enqueue(task);
  //   });
  //   this.taskState = TaskState.RUNNING;
  //   return new Promise(resolve => {
  //     this.resolve = resolve;
  //     for (let i = 0; i < this.maxConcurrentTasks; i++) {
  //       this.next();
  //     }
  //   });
  // }
  // clear(): void {
  //   this.taskState = TaskState.COMPLETED;
  //   this.currentRuningTasksMap.forEach(({ controller }) => {
  //     controller.abort();
  //   });
  //   this.queue.clear();
  //   this.currentRuningTasksMap.clear();
  // }
  // onProgressChange(callback: (index: number) => void): void {
  //   this.progressCallback = callback;
  // }
}
