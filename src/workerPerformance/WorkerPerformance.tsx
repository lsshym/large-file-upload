import TestWorker from './testWorker.ts?worker';

export const WorkerPerformance = () => {
  const testWorkerPerformance = () => {
    const worker = new TestWorker();

    for (let i = 0; i < 500; i++) {
      // 创建一个5M blob数据
      const buffer = new ArrayBuffer(5 * 1024 * 1024); // 创建 5MB 的 ArrayBuffer

      worker.postMessage({ buffer, time: new Date().getTime() }, [buffer]);
    }
    // 携带数据越小，发送越快, 如果数据可以移交，携带大数据时同时发送大量worker会影响性能, 甚至会卡死主线程
    // 如果数据可以共享内存，性能会非常快
  };
  return (
    <div>
      <button onClick={testWorkerPerformance}>测试worker发送数据性能</button>
    </div>
  );
};
