/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference lib="webworker" />

import { blake3 } from 'hash-wasm';
import { WorkerLabelsEnum, WorkerMessage } from './worker.enum';
const reader = new FileReader();

addEventListener('message', async (event: MessageEvent) => {
  const { label, data, file } = event.data;
  try {
    switch (label) {
      case WorkerLabelsEnum.INIT:
        console.log('begin')

        postMessage({
          label: WorkerLabelsEnum.DONE,
          data: await blake3(new Uint8Array(data)),
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