// md5.worker.ts
/// <reference lib="webworker" />

import { createMD5 } from "hash-wasm";
import { WorkerLabelsEnum, WorkerMessage } from "./worker.enum";


addEventListener("message", async (event: MessageEvent) => {
  const { label, data }: WorkerMessage = event.data;
  const md5 = await createMD5();

  if (label === WorkerLabelsEnum.INIT) {
    md5.init();
    data.forEach((buffer) => {
      md5.update(new Uint8Array(buffer));
    });
    const hash = md5.digest("hex");
    
    postMessage({
      label: WorkerLabelsEnum.DONE,
      data: hash,
    });
  }
});
