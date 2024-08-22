import { BehaviorSubject, Subscription, Subject } from "rxjs";

// Define the type for asynchronous functions
type AsyncFunction = () => Promise<any>;

export class PromisePool {
  // Stores the queue of tasks to be executed, each containing the task function and its index in the results array
  private readonly queue: { fn: AsyncFunction; index: number }[] = [];
  // Maximum number of concurrent tasks
  private readonly maxConcurrentTasks: number;
  // Stores the execution results of all tasks
  private results: any[] = [];
  // Subscription object used to unsubscribe
  private subscription: Subscription | null = null;

  // The number of currently running tasks, using BehaviorSubject to implement the publish-subscribe pattern
  private currentRunningCount = new BehaviorSubject(0);
  // Flag to determine whether tasks are paused
  private isPaused = false;
  // The index of the currently executing task
  private currentTaskIndex = 0;

  // Using Subject to publish task status changes, which can be subscribed to externally
  public status$ = new Subject<{ currentTask: number; queue: any[] }>();

  /**
   * Constructor to initialize the task pool
   * @param {AsyncFunction[]} functions - Array of task functions
   * @param {number} [maxConcurrentTasks] - Maximum number of concurrent tasks, default is the number of CPU cores
   */
  constructor(
    functions: AsyncFunction[],
    maxConcurrentTasks: number = navigator.hardwareConcurrency || 8
  ) {
    // Initialize the task queue, mapping task functions to their corresponding index in the results array
    this.queue = functions.map((fn, index) => ({ fn, index }));
    this.maxConcurrentTasks = maxConcurrentTasks;

    // Initialize the task status publication
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
      // Subscribe to the current running task count
      // This is the core of the publish-subscribe pattern, where tasks are scheduled by subscribing to the changes in task count, automatically triggering the next task when one completes
      this.subscription = this.currentRunningCount.subscribe((count) => {
        // If the task pool has started, is not paused, the number of running tasks is less than the maximum concurrency, and there are tasks remaining in the queue
        if (
          !this.isPaused &&
          count < this.maxConcurrentTasks &&
          this.queue.length > 0
        ) {
          // Calculate the number of tasks that can be started
          const availableSlots = this.maxConcurrentTasks - count;
          // Extract tasks from the queue that can be executed
          const tasksToRun = this.queue.splice(0, availableSlots);

          // Update the number of currently running tasks
          this.currentRunningCount.next(count + tasksToRun.length);

          // Execute the extracted tasks
          tasksToRun.forEach(({ fn, index }) => {
            // Update the current task index
            this.currentTaskIndex = index;
            // Publish the current task status
            this.status$.next({
              currentTask: index, // Add 1 because the index starts from 0, making it more intuitive when displayed
              queue: this.queue,
            });

            fn()
              .then((result) => {
                // On success, store the result
                this.results[index] = result;
              })
              .catch((error) => {
                // On failure, store the error message
                this.results[index] = error;
              })
              .finally(() => {
                // Whether the task succeeds or fails, decrease the number of running tasks
                this.currentRunningCount.next(
                  this.currentRunningCount.value - 1
                );
              });
          });
        }

        // If all tasks are completed (no tasks running and the queue is empty)
        if (this.currentRunningCount.value === 0 && this.queue.length === 0) {
          // Resolve the final results array
          resolve(this.results as T[]);
          // Unsubscribe to clean up resources
          this.unsubscribe();
        }
      });

      // Immediately trigger the subscription to start the first batch of tasks
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
      this.currentRunningCount.next(this.currentRunningCount.value); // Trigger task scheduling
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

    // Publish the updated task status
    this.status$.next({
      currentTask: this.currentTaskIndex,
      queue: this.queue,
    });

    // If the task pool has already started and is not paused, immediately trigger task scheduling
    if (!this.isPaused) {
      this.currentRunningCount.next(this.currentRunningCount.value); // Trigger task scheduling
    }
  }

  private unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
