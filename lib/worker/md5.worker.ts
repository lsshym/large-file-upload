// md5.worker.ts
/// <reference lib="webworker" />

import { md5 } from "hash-wasm";

addEventListener("message", async ({ data }: { data: ArrayBuffer }) => {
  const hash = await md5(new Uint8Array(data));

  postMessage(hash);
});
