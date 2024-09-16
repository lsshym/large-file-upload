/// <reference lib="webworker" />

import { createBLAKE3 } from 'hash-wasm';
import { WorkerLabelsEnum, WorkerMessage } from './worker.enum';
import { IHasher } from 'hash-wasm/dist/lib/WASMInterface';

let blake3: IHasher;
addEventListener('message', async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;
  try {
    switch (label) {
      case WorkerLabelsEnum.INIT:
        blake3 = await createBLAKE3();
        blake3.init();
        (data as ArrayBuffer[]).forEach(buffer => {
          console.log(WorkerLabelsEnum.DOING);
          blake3.update(new Uint8Array(buffer));
        });
        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: blake3.digest('hex'),
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

