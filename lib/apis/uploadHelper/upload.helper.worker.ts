/* eslint-disable @typescript-eslint/no-explicit-any */

import RequestWorker from './request.worker.ts?worker';

export enum RequestWorkerLabelsEnum {
  INIT = 'INIT',
  DONE = 'DONE',
  ERROR = 'ERROR',
}
export enum RequestChannelLabelsEnum {
  INIT = 'INIT',
  RUNNING = 'RUNNING',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  CLEAR = 'CLEAR',
  DONE = 'DONE',
  PROGRESS = 'PROGRESS',
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

export class UploadWorkerHelper<T = any, R = any> {
  private resolve!: (value: { results: (R | Error)[]; errorTasks: Task<T>[] }) => void; // 保存 resolve
  // 进度条
  private progressCallback: (index: number) => void = () => {};
  private workerControl: any;
  constructor(tasksData: T[], options: UploadHelperOptions = {}) {
    const worker = new RequestWorker();
    const channel = new MessageChannel();
    worker.onmessage = this.handleWorkerMessage.bind(this);
    channel.port2.onmessage = this.handleChannelMessage.bind(this);
    this.workerControl = {
      worker,
      channel,
    };
    worker.postMessage({ label: RequestWorkerLabelsEnum.INIT, port: channel.port1 }, [
      channel.port1,
    ]);

    channel.port2.postMessage({
      data: { tasksData, options },
      label: RequestChannelLabelsEnum.INIT,
    });
  }
  private handleChannelMessage(event: MessageEvent) {
    const { data, label } = event.data;
    switch (label) {
      case RequestChannelLabelsEnum.DONE: {
        this.resolve(data);
        break;
      }
      case RequestChannelLabelsEnum.ERROR: {
        this.resolve(data);
        break;
      }
      case RequestChannelLabelsEnum.PROGRESS: {
        this.progressCallback(data);
        break;
      }
      default:
        break;
    }
  }
  private handleWorkerMessage(event: MessageEvent) {
    const { data, label } = event.data;
    if (label === RequestWorkerLabelsEnum.DONE) {
      this.resolve(data);
    } else if (label === RequestWorkerLabelsEnum.ERROR) {
      this.resolve(data);
    }
  }
  run(requestOption: any): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }> {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.workerControl.channel.port2.postMessage({
        label: RequestChannelLabelsEnum.RUNNING,
        data: {
          requestOption,
        },
      });
    });
  }

  pause(): void {
    this.workerControl.channel.port2.postMessage({
      label: RequestChannelLabelsEnum.PAUSE,
    });
  }

  resume(): void {
    this.workerControl.channel.port2.postMessage({
      label: RequestChannelLabelsEnum.RESUME,
    });
  }
  clear(): void {
    this.workerControl.channel.port2.postMessage({
      label: RequestChannelLabelsEnum.CLEAR,
    });
  }
  onProgressChange(callback: (index: number) => void): void {
    this.progressCallback = callback;
  }
}
