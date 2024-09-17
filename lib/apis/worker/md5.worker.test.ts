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

        const md5 = await createMD5();
        md5.init();
        data.forEach(buffer => {
          md5.update(new Uint8Array(buffer));
        });
        const va = md5.digest('binary');
        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: va, // 返回哈希结果
          index, // 将块的索引返回
        });
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
