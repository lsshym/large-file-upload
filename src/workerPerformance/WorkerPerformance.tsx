/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileChunks } from '../../lib/main';
// import TestWorker from './testWorker.ts?worker';

export const WorkerPerformance = () => {
  const testWorkerPerformance = async (event: any) => {
    // const worker = new TestWorker();
    const worker = new Worker(new URL('./testWorker.ts', import.meta.url), {
      type:'module',
    });
    const channel = new MessageChannel();
    worker.postMessage({ port: channel.port1 }, [channel.port1]);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      const { fileChunks } = createFileChunks(file);
      // fileChunks.forEach(async (chunk, index) => {
      //   const time = new Date().getTime();
      //   channel.port2.postMessage({ chunk, index, time });
      // });
      const time = new Date().getTime();
      channel.port2.postMessage({ fileChunks, time });
    }

    console.time('Blob to ArrayBuffer Conversion Total Time'); // 开始计时
    // for (let i = 0; i < 500; i++) {
    //   // 创建一个5MB blob数据
    //   const sizeInBytes = 2 * 10 * 1024 * 1024; // 5MB
    //   const chunkSize = 64 * 1024; // 每个 chunk 大小 64KB (crypto.getRandomValues 限制)
    //   const numChunks = Math.ceil(sizeInBytes / chunkSize); // 计算需要多少个 chunk

    //   const data = [];
    //   for (let j = 0; j < numChunks; j++) {
    //     const chunk = new Uint8Array(Math.min(chunkSize, sizeInBytes - j * chunkSize)); // 剩余大小不足64KB时调整chunk大小
    //     crypto.getRandomValues(chunk); // 填充64KB的随机数据
    //     data.push(chunk);
    //   }
    //   const blob = new Blob(data, { type: 'application/octet-stream' }); // 将所有 chunk 合并成一个 Blob

    //   // const buffer = new ArrayBuffer(5 * 1024 * 1024); // 创建 5MB 的 ArrayBuffer
    //   // channel.port2.postMessage({ buffer, time: new Date().getTime() }, [buffer]);

    //   // const arraybuffer = await blob.arrayBuffer();

    //   // worker.postMessage({ arraybuffer, time: new Date().getTime() }, [arraybuffer]);
    //   // const buffer = new ArrayBuffer(5 * 1024 * 1024); // 创建 5MB 的 ArrayBuffer

    //   // worker.postMessage({ buffer, time: new Date().getTime() }, [buffer]);
    // }
    console.timeEnd('Blob to ArrayBuffer Conversion Total Time');
  };
  return (
    <div>
      测试worker发送数据性能
      <input type="file" onChange={testWorkerPerformance}></input>
    </div>
  );
};
