/// <reference lib="webworker" />

import { createMD5 } from 'hash-wasm';
import { WorkerLabelsEnum, WorkerMessage } from './worker.enum';
import { IHasher } from 'hash-wasm/dist/lib/WASMInterface';

let md5: IHasher;
addEventListener('message', async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;
  try {
    switch (label) {
      case WorkerLabelsEnum.INIT:
        if (!md5) {
          md5 = await createMD5();
        }
        md5.init();
        postMessage({
          label: WorkerLabelsEnum.INIT_DONE,
        });
        break;
      case WorkerLabelsEnum.DOING:
        (data as ArrayBuffer[]).forEach(buffer => {
          console.log(WorkerLabelsEnum.DOING);
          md5.update(new Uint8Array(buffer));
        });
        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: md5.digest('hex'),
        });
        break;
    }
  } catch (error) {
    // 发送错误信息回主线程
    postMessage({
      label: WorkerLabelsEnum.ERROR,
      data: error.message,
    });
  }
});
