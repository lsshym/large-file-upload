import { BehaviorSubject, Subscription } from 'rxjs';

type AsyncFunction = () => Promise<any>;

export class PromisePool {
  // 用于存储待执行的任务队列，每个任务都包含了任务函数和在结果数组中的索引
  private readonly queue: { fn: AsyncFunction, index: number }[] = [];
  // 最大并发任务数
  private readonly maxConcurrentTasks: number;
  // 存储所有任务的执行结果
  private results: any[] = [];
  // 订阅对象，用于取消订阅
  private subscription: Subscription | null = null;

  // 当前正在运行的任务数量，这里使用 BehaviorSubject 来实现发布-订阅模式
  private currentRunningCount = new BehaviorSubject(0);

  /**
   * 构造函数初始化任务池
   * @param {AsyncFunction[]} functions - 任务函数数组
   * @param {number} [maxConcurrentTasks] - 最大并发任务数，默认为 CPU 核心数
   */
  constructor(
    functions: AsyncFunction[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 8,
  ) {
    // 初始化任务队列，将任务函数和其在结果数组中的索引一一对应
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;
  }

  /**
   * 执行任务池中的所有异步函数
   * @returns {Promise<T[]>} 返回一个包含所有任务结果的 Promise 数组
   */
  exec<T>(): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      // 订阅当前运行的任务计数
      // 这里是发布-订阅模式的核心，通过订阅任务计数的变化来调度任务，当一个任务完成时自动触发下一个
      this.subscription = this.currentRunningCount.subscribe((count) => {
        // 如果当前正在运行的任务数小于最大并发数且队列中还有任务未执行
        if (count < this.maxConcurrentTasks && this.queue.length > 0) {
          // 计算当前可以启动的任务数
          const availableSlots = this.maxConcurrentTasks - count;
          // 从队列中取出可以执行的任务
          const tasksToRun = this.queue.splice(0, availableSlots);

          // 更新当前正在运行的任务数
          this.currentRunningCount.next(count + tasksToRun.length);

          // 执行取出的任务
          tasksToRun.forEach(({ fn, index }) => {
            fn()
              .then((result) => {
                // 任务成功，存储结果
                this.results[index] = result;
              })
              .catch((error) => {
                // 任务失败，存储错误信息
                this.results[index] = error;
              })
              .finally(() => {
                // 无论任务成功还是失败，减少当前正在运行的任务数
                this.currentRunningCount.next(this.currentRunningCount.value - 1);
              });
          });
        }

        // 如果所有任务都已经完成（无任务正在运行且队列为空）
        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          // 解析最终的结果数组
          resolve(this.results as T[]);
          // 取消订阅，清理资源
          this.unsubscribe();
        }
      });

      // 立即触发一次订阅，以启动第一个批次的任务
      this.currentRunningCount.next(this.currentRunningCount.value);
    });
  }

  /**
   * 取消订阅，以避免内存泄漏。
   * 在不再需要使用该类时应调用此方法。
   */
  private unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
