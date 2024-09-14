/// <reference lib="webworker" />

import { createBLAKE3 } from 'hash-wasm';
import { WorkerLabelsEnum, WorkerMessage } from './worker.enum';

addEventListener('message', async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;
  if (!label) throw new Error(`Unexpected label received: ${label}`);

  try {
    const md5 = await createBLAKE3();
    switch (label) {
      case WorkerLabelsEnum.INIT:
        md5.init();
        break;
      case WorkerLabelsEnum.DOING:
        (data as ArrayBuffer[]).forEach(buffer => {
          md5.update(new Uint8Array(buffer));
        });
        break;
      case WorkerLabelsEnum.DONE: {
        const hash = md5.digest('hex');
        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: hash,
        });
        break;
      }
    }
  } catch (error) {
    // 发送错误信息回主线程
    postMessage({
      label: WorkerLabelsEnum.ERROR,
      data: error.message,
    });
  }
});
