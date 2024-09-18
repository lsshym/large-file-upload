import { SimpleBehaviorSubject, SimpleSubject } from './simpleObservable';
// 定义异步函数的类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncFunction = () => Promise<any>;

export class PromisePool {
  // 存储待执行任务的队列，每个任务包含任务函数及其在结果数组中的索引
  private readonly queue: { fn: AsyncFunction; index: number }[] = [];
  // 最大并发任务数
  private readonly maxConcurrentTasks: number;
  // 存储所有任务的执行结果
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private results: any[] = [];
  // 用于取消订阅的 Subscription 对象
  private subscription: { unsubscribe: () => void } | null = null;

  // 当前正在运行的任务数，使用 BehaviorSubject 实现发布订阅模式
  private currentRunningCount = new SimpleBehaviorSubject(0);
  // 标志任务是否暂停
  private isPaused = false;
  // 当前正在执行的任务索引
  private currentTaskIndex = 0;

  // 使用 Subject 来发布任务状态的变化，外部可以订阅
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public status$ = new SimpleSubject<{ currentTask: number; queue: any[] }>();

  /**
   * Constructor to initialize the task pool
   * @param {AsyncFunction[]} functions - Array of task functions
   * @param {number} [maxConcurrentTasks] - Maximum number of concurrent tasks, default is the number of CPU cores
   */
  constructor(
    functions: AsyncFunction[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 4,
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
    return new Promise<T[]>(resolve => {
      this.subscription = this.currentRunningCount.subscribe(count => {
        if (!this.isPaused && count < this.maxConcurrentTasks && this.queue.length > 0) {
          const availableSlots = this.maxConcurrentTasks - count;
          const tasksToRun = this.queue.splice(0, availableSlots);

          this.currentRunningCount.next(count + tasksToRun.length);

          tasksToRun.forEach(({ fn, index }) => {
            this.currentTaskIndex = index;
            this.status$.next({
              currentTask: index,
              queue: this.queue,
            });

            fn()
              .then(result => {
                this.results[index] = result;
              })
              .catch(error => {
                this.results[index] = error;
              })
              .finally(() => {
                this.currentRunningCount.next(this.currentRunningCount.value - 1);
              });
          });
        }

        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          resolve(this.results as T[]);
          this.unsubscribe();
        }
      });

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
