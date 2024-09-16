/// <reference lib="webworker" />

import { IHasher } from 'hash-wasm/dist/lib/WASMInterface';
import { WorkerLabelsEnum, WorkerMessage } from './worker.enum';
import { createMD5 } from 'hash-wasm';

let md5: IHasher;
addEventListener('message', async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;
  try {
    switch (label) {
      case WorkerLabelsEnum.DOING:
        console.log('workers');

        if (!md5) {
          md5 = await createMD5();
          md5.init();
        }
        md5?.update(new Uint8Array(data));
        break;
      case WorkerLabelsEnum.TEST:
        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: md5.digest('hex'),
        });
    }
  } catch (error) {
    // 发送错误信息回主线程
    postMessage({
      label: WorkerLabelsEnum.ERROR,
      data: error.message,
    });
  }
});
