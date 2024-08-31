/// <reference lib="webworker" />

import { createMD5 } from "hash-wasm";
import { WorkerLabelsEnum, WorkerMessage } from "./worker.enum";

addEventListener("message", async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;

  try {
    const md5 = await createMD5();

    if (label === WorkerLabelsEnum.INIT) {
      md5.init();
      (data as ArrayBuffer[]).forEach((buffer) => {
        md5.update(new Uint8Array(buffer));
      });
      const hash = md5.digest("hex");

      // 发送计算结果回主线程
      postMessage({
        label: WorkerLabelsEnum.DONE,
        data: hash,
      });

      // 显式释放内存
    } else {
      throw new Error(`Unexpected label received: ${label}`);
    }
  } catch (error) {
    // 发送错误信息回主线程
    postMessage({
      label: WorkerLabelsEnum.ERROR,
      data: error.message,
    });
  }
});
