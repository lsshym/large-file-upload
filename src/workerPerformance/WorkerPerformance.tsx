import TestWorker from './testWorker.ts?worker';

export const WorkerPerformance = () => {
  const testWorkerPerformance = async () => {
    const worker = new TestWorker();

    for (let i = 0; i < 500; i++) {
      // 创建一个5MB blob数据
      const sizeInBytes = 5 * 1024 * 1024; // 5MB
      const chunkSize = 64 * 1024; // 每个 chunk 大小 64KB (crypto.getRandomValues 限制)
      const numChunks = Math.ceil(sizeInBytes / chunkSize); // 计算需要多少个 chunk

      const data = [];
      for (let j = 0; j < numChunks; j++) {
        const chunk = new Uint8Array(Math.min(chunkSize, sizeInBytes - j * chunkSize)); // 剩余大小不足64KB时调整chunk大小
        crypto.getRandomValues(chunk); // 填充64KB的随机数据
        data.push(chunk);
      }

      const blob = new Blob(data, { type: 'application/octet-stream' }); // 将所有 chunk 合并成一个 Blob
      const arraybuffer = await blob.arrayBuffer();
      worker.postMessage({ arraybuffer, time: new Date().getTime() }, [arraybuffer]);
      // const buffer = new ArrayBuffer(5 * 1024 * 1024); // 创建 5MB 的 ArrayBuffer

      // worker.postMessage({ buffer, time: new Date().getTime() }, [buffer]);
    }
  };
  return (
    <div>
      <button onClick={testWorkerPerformance}>测试worker发送数据性能</button>
    </div>
  );
};
