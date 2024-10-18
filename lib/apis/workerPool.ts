/* eslint-disable @typescript-eslint/no-explicit-any */
export class WebWorkerPool {
  private workers: Array<{
    worker: Worker;
    taskQueue: any[];
  }>;

  constructor(worker: Worker, config?: { workerCount: number }) {
    const { workerCount = navigator.hardwareConcurrency || 4 } = config || {};
    this.workers = Array.from({ length: workerCount }, () => {
      return {
        worker: worker,
        taskQueue: [],
        onMessage: (worker.onmessage = (event: MessageEvent) => {
          console.log(event.data);
        }),
      };
    });
  }

  addTask<T>(task: T) {
    const minWorker = this.workers.reduce((prev, curr) => {
      if (curr.taskQueue.length === 0) {
        return curr;
      }
      return prev.taskQueue.length <= curr.taskQueue.length ? prev : curr;
    });
    minWorker.taskQueue.push(task);
    this.runTask();
  }
  private runTask() {
    this.workers.forEach(({ worker, taskQueue }) => {
      if (taskQueue.length > 0) {
        const task = taskQueue.shift();
        console.log(worker);
        worker.postMessage(task);
      }
    });
  }
}
