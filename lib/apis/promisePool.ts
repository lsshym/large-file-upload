import { SimpleBehaviorSubject } from './simpleObservable';
// 定义异步函数的类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncFunction = (props: { signal: AbortSignal }) => Promise<any>;

export class PromisePool {
  private queue: { fn: AsyncFunction; index: number }[] = [];
  private maxConcurrentTasks: number;
  private results: any[] = [];
  private currentRunningCount = new SimpleBehaviorSubject(0);
  private isPaused = false;
  private currentTaskIndex = 0;
  private controllers: { [index: number]: { fn: any; controller: AbortController } } = {};

  constructor(
    functions: AsyncFunction[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 4,
  ) {
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;
  }

  exec<T>(): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const processQueue = () => {
        if (this.isPaused || this.currentRunningCount.value >= this.maxConcurrentTasks) {
          return;
        }
        if (this.queue.length === 0 && this.currentRunningCount.value === 0) {
          resolve(this.results as T[]);
          return;
        }
        while (
          !this.isPaused &&
          this.currentRunningCount.value < this.maxConcurrentTasks &&
          this.queue.length > 0
        ) {
          const { fn, index } = this.queue.shift()!;
          const controller = new AbortController();
          this.controllers[index] = { controller, fn, index };
          this.currentRunningCount.next(this.currentRunningCount.value + 1);

          fn({
            signal: controller.signal,
          })
            .then(result => {
              this.results[index] = result;
            })
            .catch(error => {
              this.results[index] = error;
            })
            .finally(() => {
              this.currentRunningCount.next(this.currentRunningCount.value - 1);
              delete this.controllers[index];
              this.currentTaskIndex++;
              processQueue(); // 继续处理队列中的任务
            });
        }
      };

      this.currentRunningCount.subscribe(() => {
        processQueue();
      });

      // 开始处理任务队列
      processQueue();
    });
  }

  pause() {
    this.isPaused = true;

    Object.values(this.controllers).forEach(({ controller, fn, index }) => {
      console.log(controller, fn);
      controller.abort();
      this.queue.unshift({ fn, index });
      this.controllers = {};
      // this.currentRunningCount.next(0);
    });
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentRunningCount.next(this.currentRunningCount.value);
    }
  }

  cancelAll() {
    this.isPaused = true;
    // 中止所有正在执行的任务
    Object.values(this.controllers).forEach(controller => {
      controller.abort();
    });
    // 清空控制器和任务队列
    this.controllers = {};
    this.queue = [];
    // 重置当前运行计数
    this.currentRunningCount.next(0);
  }

  addTasks(functions: AsyncFunction[]) {
    const startIndex = this.results.length;
    functions.forEach((fn, index) => {
      this.queue.push({ fn, index: startIndex + index });
    });

    // 如果未暂停，立即尝试处理新添加的任务
    if (!this.isPaused) {
      this.currentRunningCount.next(this.currentRunningCount.value);
    }
  }
  private unsubscribe() {
    // if (this.subscription) {
    //   this.subscription.unsubscribe();
    //   this.subscription = null;
    // }
  }
}
