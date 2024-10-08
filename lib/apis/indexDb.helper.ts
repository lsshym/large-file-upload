// IndexedDB 操作辅助类
export class IndexedDBHelper {
  // 私有成员变量
  private dbName: string; // 数据库名称
  private storeName: string; // 对象存储（表）名称
  private dbPromise: Promise<IDBDatabase>; // 用于存储数据库连接的 Promise

  // 构造函数，初始化数据库名称和对象存储名称，并打开数据库连接
  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbPromise = this.openDB(); // 打开数据库连接
  }

  // 私有方法，打开 IndexedDB 数据库，并返回一个 Promise
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1); // 打开数据库，版本号为 1

      // 数据库升级事件，用于创建或更新对象存储
      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result; // 获取数据库实例
        db.createObjectStore(this.storeName, { keyPath: 'index' }); // 创建对象存储，指定主键为 'index'
      };

      // 成功打开数据库连接
      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result; // 获取数据库实例
        resolve(db); // 解析 Promise，返回数据库实例
      };

      // 打开数据库连接失败
      request.onerror = event => {
        reject((event.target as IDBOpenDBRequest).error); // 拒绝 Promise，返回错误信息
      };
    });
  }

  // 添加任务的方法，接受一个包含 data 和 index 的对象
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async addTask(task: { data: any; index: number }) {
    const db = await this.dbPromise; // 等待数据库连接
    const transaction = db.transaction(this.storeName, 'readwrite'); // 创建读写事务
    const store = transaction.objectStore(this.storeName); // 获取对象存储
    store.add(task); // 将任务添加到对象存储

    // 返回一个 Promise，当事务完成或出错时解析或拒绝
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve(); // 事务成功完成
      transaction.onerror = () => reject(transaction.error); // 事务出错
    });
  }

  // 删除任务的方法，接受任务的 index
  async deleteTask(index: number) {
    const db = await this.dbPromise; // 等待数据库连接
    const transaction = db.transaction(this.storeName, 'readwrite'); // 创建读写事务
    const store = transaction.objectStore(this.storeName); // 获取对象存储
    store.delete(index); // 删除指定 index 的任务

    // 返回一个 Promise，当事务完成或出错时解析或拒绝
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve(); // 事务成功完成
      transaction.onerror = () => reject(transaction.error); // 事务出错
    });
  }

  // 获取所有任务的方法，返回一个包含任务数组的 Promise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAllTasks(): Promise<{ data: any; index: number }[]> {
    const db = await this.dbPromise; // 等待数据库连接
    const transaction = db.transaction(this.storeName, 'readonly'); // 创建只读事务
    const store = transaction.objectStore(this.storeName); // 获取对象存储
    const request = store.getAll(); // 获取所有任务

    // 返回一个 Promise，当请求成功或出错时解析或拒绝
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result); // 请求成功，返回结果
      request.onerror = () => reject(request.error); // 请求出错，返回错误信息
    });
  }
  static getTasksByDbName(
    dbName: string,
    storeName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ data: any; index: number }[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          reject(new Error(`对象存储 "${storeName}" 不存在`));
          return;
        }
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };

      request.onerror = event => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
}

// // 创建 IndexedDBHelper 实例
// const dbHelper = new IndexedDBHelper('myDatabase', 'tasksStore');

// // 添加任务
// dbHelper.addTask({ data: { title: '任务一', description: '描述信息' }, index: 1 })
//   .then(() => console.log('任务添加成功'))
//   .catch(error => console.error('添加任务出错', error));

// // 删除任务
// dbHelper.deleteTask(1)
//   .then(() => console.log('任务删除成功'))
//   .catch(error => console.error('删除任务出错', error));

// // 获取所有任务
// dbHelper.getAllTasks()
//   .then(tasks => console.log('所有任务：', tasks))
//   .catch(error => console.error('获取任务出错', error));
