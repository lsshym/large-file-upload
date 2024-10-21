/* eslint-disable @typescript-eslint/no-explicit-any */
import YoctoQueue from 'yocto-queue';

import RequestWorker from './request.worker.ts?worker';
enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}

export enum RequestWorkerLabelsEnum {
  INIT = 'INIT',
  INITED = 'INITED',
  RUNNING = 'RUNNING',
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
  private resolve!: (value: { results: (R | Error)[]; errorTasks: Task<T>[] }) => void; // 保存 resolve
  private maxRetries: number;
  private retryDelay: number;
  // 进度条
  private progress = 0; // 当前任务的索引
  private progressCallback: (index: number) => void = () => {};
  private workerControl: any;
  private blobKey: string | undefined;
  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const { maxConcurrentTasks = 5, maxRetries = 3, retryDelay = 1000 } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;

    const worker = new RequestWorker();
    const channel = new MessageChannel();
    worker.postMessage({ label: RequestWorkerLabelsEnum.INIT, port: channel.port1 }, [
      channel.port1,
    ]);
    this.workerControl = {
      worker,
      channel,
    };
    // const time = new Date().getTime();
    // channel.port2.postMessage({ fileChunks, time });
    // if (tasksData[0]) {
    //   const taskEntries = Object.entries(tasksData[0]);
    //   this.blobKey = taskEntries.find(([, value]) => value instanceof Blob)?.[0];
    // }
    // 1 还是用链表，只有在执行的时候，把任务发送到worker，这里只管发送，具体任务让worker自己去分配
    // tasksData.forEach((data, index) => {
    //   this.queue.enqueue({ data, index });
    // });
  }

  run(runOption: any): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    this.taskState = TaskState.RUNNING;

    return new Promise(resolve => {
      // this.resolve = resolve;
      this.workerControl.channel.port2.postMessage({ fileChunks, time });
      this.next();
      // worker初始化，在哪里管理worker
      // 如果在让workerpool自动管理，这里只需要向workerpool发送任务,并发数让worker自己控制
      //
      // 或者这里新建几个worker，然后按照老的思路，每个worker持续处理任务
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
    // 遍历task，找到blob类型的数据

    const { chunk, ...other } = task.data as any;
    const arrayBuffer = await chunk.arrayBuffer();
    // worker.postMessage(
    //   {
    //     label: RequestWorkerLabelsEnum.DOING,
    //     data: other,
    //     arrayBuffer,
    //     index: task.index,
    //   },
    //   // [arrayBuffer],
    // );
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
