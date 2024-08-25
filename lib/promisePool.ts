import { BehaviorSubject, Subscription, Subject } from "rxjs";

// 定义异步函数的类型
type AsyncFunction = () => Promise<any>;

export class PromisePool {
  // 存储待执行任务的队列，每个任务包含任务函数及其在结果数组中的索引
  private readonly queue: { fn: AsyncFunction; index: number }[] = [];
  // 最大并发任务数
  private readonly maxConcurrentTasks: number;
  // 存储所有任务的执行结果
  private results: any[] = [];
  // 用于取消订阅的 Subscription 对象
  private subscription: Subscription | null = null;

  // 当前正在运行的任务数，使用 BehaviorSubject 实现发布订阅模式
  private currentRunningCount = new BehaviorSubject(0);
  // 标志任务是否暂停
  private isPaused = false;
  // 当前正在执行的任务索引
  private currentTaskIndex = 0;

  // 使用 Subject 来发布任务状态的变化，外部可以订阅
  public status$ = new Subject<{ currentTask: number; queue: any[] }>();

  /**
   * Constructor to initialize the task pool
   * @param {AsyncFunction[]} functions - Array of task functions
   * @param {number} [maxConcurrentTasks] - Maximum number of concurrent tasks, default is the number of CPU cores
   */
  constructor(
    functions: AsyncFunction[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 4
  ) {
    // 初始化任务队列，将任务函数映射到其在结果数组中的索引
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;

    // 初始化任务状态发布
    this.status$.next({
      currentTask: this.currentTaskIndex,
      queue: this.queue,
    });
  }

  /**
   * Executes all asynchronous functions in the task pool
   * @returns {Promise<T[]>} Returns a Promise array containing the results of all tasks
   */
  exec<T>(): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      // 订阅当前运行任务的数量
      // 这是发布订阅模式的核心，通过订阅任务数量的变化进行任务调度，当一个任务完成时自动触发下一个任务
      this.subscription = this.currentRunningCount.subscribe((count) => {
        // 如果任务池已启动、未暂停、运行中的任务数少于最大并发数且队列中还有任务
        if (
          !this.isPaused &&
          count < this.maxConcurrentTasks &&
          this.queue.length > 0
        ) {
          // 计算可以启动的任务数
          const availableSlots = this.maxConcurrentTasks - count;
          // 从队列中提取可以执行的任务
          const tasksToRun = this.queue.splice(0, availableSlots);

          // 更新当前运行中的任务数
          this.currentRunningCount.next(count + tasksToRun.length);

          // 执行提取的任务
          tasksToRun.forEach(({ fn, index }) => {
            // 更新当前任务索引
            this.currentTaskIndex = index;
            // 发布当前任务状态
            this.status$.next({
              currentTask: index, // 加 1 因为索引从 0 开始，显示时更直观
              queue: this.queue,
            });

            fn()
              .then((result) => {
                // 成功时，存储结果
                this.results[index] = result;
              })
              .catch((error) => {
                // 失败时，存储错误信息
                this.results[index] = error;
              })
              .finally(() => {
                // 无论任务成功或失败，减少运行中的任务数
                this.currentRunningCount.next(
                  this.currentRunningCount.value - 1
                );
              });
          });
        }

        // 如果所有任务都已完成（无任务在运行且队列为空）
        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          // 解析最终的结果数组
          resolve(this.results as T[]);
          // 取消订阅以清理资源
          this.unsubscribe();
        }
      });

      // 立即触发订阅以启动第一批任务
      this.currentRunningCount.next(this.currentRunningCount.value);
    });
  }

  /**
   * Pauses task execution
   * Sets the isPaused flag to true
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resumes task execution
   * Restarts the paused task scheduling
   */
  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.currentRunningCount.next(this.currentRunningCount.value); // 触发任务调度
    }
  }

  /**
   * Clears the task queue
   * Empties the task queue and publishes the task status
   */
  clear() {
    this.queue.length = 0;
    this.status$.next({ currentTask: 0, queue: this.queue });
  }

  /**
   * Adds new tasks to the queue
   * @param {AsyncFunction[]} newTasks - Array of new tasks
   */
  addTasks(newTasks: AsyncFunction[]) {
    const startIndex = this.results.length;
    newTasks.forEach((fn, index) => {
      this.queue.push({ fn, index: startIndex + index });
    });

    // 发布更新后的任务状态
    this.status$.next({
      currentTask: this.currentTaskIndex,
      queue: this.queue,
    });

    // 如果任务池已启动且未暂停，立即触发任务调度
    if (!this.isPaused) {
      this.currentRunningCount.next(this.currentRunningCount.value); // 触发任务调度
    }
  }

  private unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
