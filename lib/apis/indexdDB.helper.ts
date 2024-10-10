// IndexedDB 操作辅助类
export class IndexedDBHelper<T> {
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
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true }); // 创建对象存储，主键为 'id'，自动递增
        }
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

  // 添加数据的方法，接受一个对象
  async add(item: T): Promise<number> {
    const db = await this.dbPromise; // 等待数据库连接
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite'); // 创建读写事务
      const store = transaction.objectStore(this.storeName); // 获取对象存储
      const request = store.add(item); // 将数据添加到对象存储

      request.onsuccess = () => {
        resolve(request.result as number); // 返回新增记录的主键值
      };
      request.onerror = () => {
        reject(request.error); // 返回错误信息
      };
    });
  }

  // 根据主键删除数据的方法
  async delete(key: IDBValidKey): Promise<void> {
    const db = await this.dbPromise; // 等待数据库连接
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite'); // 创建读写事务
      const store = transaction.objectStore(this.storeName); // 获取对象存储
      const request = store.delete(key); // 删除指定主键的数据

      request.onsuccess = () => resolve(); // 操作成功
      request.onerror = () => reject(request.error); // 操作失败
    });
  }

  // 更新数据的方法
  async update(item: T & { id: IDBValidKey }): Promise<void> {
    const db = await this.dbPromise; // 等待数据库连接
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 根据主键获取数据的方法
  async get(key: IDBValidKey): Promise<T | undefined> {
    const db = await this.dbPromise;
    return new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有数据的方法
  async getAll(): Promise<T[]> {
    const db = await this.dbPromise; // 等待数据库连接
    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly'); // 创建只读事务
      const store = transaction.objectStore(this.storeName); // 获取对象存储
      const request = store.getAll(); // 获取所有数据
      request.onsuccess = () => resolve(request.result as T[]); // 请求成功，返回结果
      request.onerror = () => reject(request.error); // 请求出错，返回错误信息
    });
  }

  // 清空对象存储的方法
  async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 静态方法，根据数据库名称和对象存储名称获取所有数据
  static getDataByDBName<T>(dbName: string, storeName: string): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => resolve(getAllRequest.result as T[]);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };

      request.onerror = event => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  static async deleteDatabase(dbName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName); // Delete the database

      request.onsuccess = () => {
        console.log(`Database ${dbName} deleted successfully`);
        resolve(); // Operation successful
      };

      request.onerror = () => {
        console.error(`Error deleting database ${dbName}`, request.error);
        reject(request.error); // Operation failed
      };

      request.onblocked = () => {
        console.warn(
          `Database deletion for ${dbName} blocked, possibly due to another page using it`,
        );
        reject(new Error('Database deletion blocked'));
      };
    });
  }
}
