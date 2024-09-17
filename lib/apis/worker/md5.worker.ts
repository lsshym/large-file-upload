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
        md5 = await createMD5();
        md5.init();
        (data as ArrayBuffer[]).forEach(buffer => {
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
// aborted 8e6c4fe2ffc51ea7d2d5b0f5d6f72126 1.1640969309955835
// main.ts:31 generateFileHashWithCrypto: 5321.97998046875 ms
// aborted 9e2e3fc42c2da23908a67f21151785a8 3.070806073024869
// main.ts:31 generateFileHashWithCrypto: 14379.7060546875 ms
// 8e6c4fe2ffc51ea7d2d5b0f5d6f72126