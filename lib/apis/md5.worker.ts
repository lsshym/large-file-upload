import { createMD5 } from 'hash-wasm';
import { WorkerLabelsEnum } from './generateIdUtils';
import * as Comlink from 'comlink';

const workerMethods = {
  async processMD5(label: WorkerLabelsEnum, data: ArrayBuffer[], index: number) {
    try {
      if (label === WorkerLabelsEnum.DOING) {
        const md5 = await createMD5();
        md5.init();

        // 对每个 ArrayBuffer 进行增量哈希更新
        data.forEach(buffer => {
          md5.update(new Uint8Array(buffer));
        });

        // 生成增量 MD5 的中间状态
        const partialHashState = md5.digest('hex'); // 返回 MD5 结果
        return { label: WorkerLabelsEnum.DONE, data: partialHashState, index };
      } else {
        throw new Error(`Unhandled message label: ${label}`);
      }
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = `${error.message}\n${error.stack}`;
      } else {
        errorMessage = String(error);
      }
      return { label: WorkerLabelsEnum.ERROR, data: errorMessage, index };
    }
  },
};

// 将 workerMethods 暴露给主线程
Comlink.expose(workerMethods);
