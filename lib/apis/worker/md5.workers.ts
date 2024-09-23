import { createMD5 } from 'hash-wasm';
import { WorkerLabelsEnum } from './worker.enum';

addEventListener('message', async (event: MessageEvent) => {
  const { label, data, index }: { label: WorkerLabelsEnum; data: ArrayBuffer[]; index: number } =
    event.data;

  try {
    switch (label) {
      case WorkerLabelsEnum.INIT: {
        const md5 = await createMD5();
        md5.init();

        // 对每个 ArrayBuffer 进行增量哈希更新
        data.forEach(buffer => {
          md5.update(new Uint8Array(buffer));
        });

        // 生成增量 MD5 的中间状态并传回主线程
        const partialHashState = md5.digest('hex'); // 返回中间的 MD5 状态

        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: partialHashState, // 发送 MD5 中间状态
          index,
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
