import TestWorker from './testWorker.ts?worker';

export const WorkerPerformance = () => {
  const testWorkerPerformance = () => {
    const worker = new TestWorker();

    for (let i = 0; i < 500; i++) {
      // 创建一个5M blob数据
      const buffer = new ArrayBuffer(5 * 1024 * 1024); // 创建 5MB 的 ArrayBuffer

      worker.postMessage({ buffer, time: new Date().getTime() }, [buffer]);
    }

  };
  return (
    <div>
      <button onClick={testWorkerPerformance}>测试worker发送数据性能</button>
    </div>
  );
};
