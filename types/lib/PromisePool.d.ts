import { Subject } from "rxjs";
type AsyncFunction = () => Promise<any>;
export declare class PromisePool {
    private readonly queue;
    private readonly maxConcurrentTasks;
    private results;
    private subscription;
    private currentRunningCount;
    private isPaused;
    private currentTaskIndex;
    status$: Subject<{
        currentTask: number;
        queue: any[];
    }>;
    /**
     * 构造函数初始化任务池
     * @param {AsyncFunction[]} functions - 任务函数数组
     * @param {number} [maxConcurrentTasks] - 最大并发任务数，默认为 CPU 核心数
     */
    constructor(functions: AsyncFunction[], maxConcurrentTasks?: number);
    /**
     * 执行任务池中的所有异步函数
     * @returns {Promise<T[]>} 返回一个包含所有任务结果的 Promise 数组
     */
    exec<T>(): Promise<T[]>;
    /**
     * 暂停任务执行
     * 将 isPaused 标志位设置为 true
     */
    pause(): void;
    /**
     * 恢复任务执行
     * 重新启动暂停的任务调度
     */
    resume(): void;
    /**
     * 清空任务队列
     * 将任务队列清空，并发布任务状态
     */
    clear(): void;
    /**
     * 添加新的任务到队列
     * @param {AsyncFunction[]} newTasks - 新的任务数组
     */
    addTasks(newTasks: AsyncFunction[]): void;
    /**
     * 取消订阅，以避免内存泄漏
     * 在不再需要使用该类时应调用此方法
     */
    private unsubscribe;
}
export {};
