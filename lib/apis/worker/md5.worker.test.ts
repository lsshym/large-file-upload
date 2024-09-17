import { createMD5 } from 'hash-wasm';
import { WorkerLabelsEnum } from './worker.enum';

// Worker 中确保处理所有块
addEventListener('message', async (event: MessageEvent) => {
  const { label, data, index }: { label: WorkerLabelsEnum; data: ArrayBuffer[]; index: number } =
    event.data;
  try {
    switch (label) {
      case WorkerLabelsEnum.INIT: {
        // 存储每个传入的 Uint8Array，不进行哈希处理

        // const md5 = await createMD5();
        // md5.init();
        // data.forEach(buffer => {
        //   md5.update(new Uint8Array(buffer));
        // });
        // const va = md5.digest('binary');
        // postMessage({
        //   label: WorkerLabelsEnum.DONE,
        //   data: va, // 返回哈希结果
        //   index, // 将块的索引返回
        // });
        // 将传入的 ArrayBuffer[] 转换为 Uint8Array[]
        const uint8ArrayChunks = data.map(buffer => new Uint8Array(buffer));

        // 合并多个 Uint8Array 为一个
        const mergedUint8Array = mergeChunks(uint8ArrayChunks);

        // 发送合并后的 Uint8Array 数据回主线程
        postMessage(
          {
            label: WorkerLabelsEnum.DONE,
            data: mergedUint8Array, // 发送合并后的 Uint8Array
            index, // 返回块的索引
          },
          [mergedUint8Array.buffer],
        ); // 使用 Transferable 对象传递 Uint8Array.buffer
        break;
      }
    }
  } catch (error) {
    postMessage({
      label: WorkerLabelsEnum.ERROR,
      data: error.message,
      index,
    });
  }
});
function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}
