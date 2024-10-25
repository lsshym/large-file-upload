/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  RequestChannelLabelsEnum,
  RequestWorkerLabelsEnum,
  Task,
  UploadHelperOptions,
} from './upload.helper.worker';
import YoctoQueue from 'yocto-queue';

export enum TaskState {
  RUNNING,
  PAUSED,
  COMPLETED,
}
let portChannel: MessagePort;
self.addEventListener('message', async (event: MessageEvent) => {
  const { label, port } = event.data;
  try {
    switch (label) {
      case RequestWorkerLabelsEnum.INIT: {
        portChannel = port;
        portChannel.onmessage = handleWorkerChannelMessage.bind(self);
        break;
      }
      default:
        throw new Error(`Unhandled message label: ${label}`);
    }
  } catch (error) {
    let errorMessage = 'Worker Unknown error';
    if (error instanceof Error) {
      errorMessage = `${error.message}\n${error.stack}`;
    } else {
      errorMessage = String(error);
    }
    postMessage({
      label: RequestWorkerLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
    });
  }
});

class UploadWorkerProcessor<T = any, R = any> {
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
  private requestOption: any;
  private maxRetries: number;
  private retryDelay: number;
  // 进度条
  private progress = 0; // 当前任务的索引
  constructor(tasksData: any[], options: UploadHelperOptions = {}) {
    const { maxConcurrentTasks = 4, maxRetries = 3, retryDelay = 1000 } = options;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    tasksData.forEach((data: any, index: any) => {
      this.queue.enqueue({ data, index });
    });
  }
  run(requestOption?: any) {
    this.taskState = TaskState.RUNNING;
    this.requestOption = requestOption;
    for (let i = 0; i < this.maxConcurrentTasks; i++) {
      this.next();
    }
  }
  private next(): void {
    if (this.taskState !== TaskState.RUNNING) {
      return;
    }
    if (this.queue.size === 0 && this.activeCount === 0) {
      this.taskState = TaskState.COMPLETED;
      portChannel.postMessage({
        label: RequestChannelLabelsEnum.DONE,
        data: {
          results: this.results,
          errorTasks: this.errorTasks,
        },
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
        portChannel.postMessage({
          label: RequestChannelLabelsEnum.PROGRESS,
          data: ++this.progress,
        });
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
  private async taskExecutor(obj: { data: any; signal: AbortSignal }) {
    const { data, signal } = obj;
    const { url, method = 'post', format, ...other } = this.requestOption;
    const fd = new FormData();
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        fd.append(format[key] || key, data[key]);
      }
    }
    const response = await fetch(url, {
      method,
      body: fd, // 确保传递的表单数据
      signal, // 传递 AbortSignal
      ...other,
    });

    return response.json();
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
  retryTasks(tasks: Task<T>[]) {
    tasks.forEach(task => {
      this.queue.enqueue(task);
    });
    this.taskState = TaskState.RUNNING;
    for (let i = 0; i < this.maxConcurrentTasks; i++) {
      this.next();
    }
  }
  clear(): void {
    this.taskState = TaskState.COMPLETED;
    this.currentRuningTasksMap.forEach(({ controller }) => {
      controller.abort();
    });
    this.queue.clear();
    this.currentRuningTasksMap.clear();
  }
}

let workerProcessor: UploadWorkerProcessor;

async function handleWorkerChannelMessage(event: MessageEvent) {
  const { label, data } = event.data;

  switch (label) {
    case RequestChannelLabelsEnum.INIT: {
      const { tasksData, options } = data;
      workerProcessor = new UploadWorkerProcessor(tasksData, options);
      break;
    }

    case RequestChannelLabelsEnum.RUNNING: {
      const { requestOption } = data;
      workerProcessor.run(requestOption);
      break;
    }

    case RequestChannelLabelsEnum.PAUSE: {
      workerProcessor.pause();
      break;
    }
    case RequestChannelLabelsEnum.RESUME: {
      workerProcessor.resume();
      break;
    }
    case RequestChannelLabelsEnum.RETRY: {
      const { tasks } = data;
      workerProcessor.retryTasks(tasks);
      break;
    }
    default:
      break;
  }
}
