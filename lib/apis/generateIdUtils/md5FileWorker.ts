import { createMD5 } from 'hash-wasm';
import { Md5FileWorkerLabelsEnum } from './generateFileFingerprint';

self.addEventListener('message', async (event: MessageEvent) => {
  const { label, data, index }: { label: Md5FileWorkerLabelsEnum; data: ArrayBuffer[]; index: number } =
    event.data;

  try {
    switch (label) {
      case Md5FileWorkerLabelsEnum.DOING: {
        const md5 = await createMD5();
        md5.init();

        // 对每个 ArrayBuffer 进行增量哈希更新
        data.forEach(buffer => {
          md5.update(new Uint8Array(buffer));
        });

        // 生成增量 MD5 的中间状态并传回主线程
        const partialHashState = md5.digest('binary'); // 返回 MD5 结果
        postMessage({
          label: Md5FileWorkerLabelsEnum.DONE,
          data: partialHashState, // 发送 MD5 结果
          index,
        });
        break;
      }
      // 可以添加其他 case
      default:
        throw new Error(`Unhandled message label: ${label}`);
    }
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = `${error.message}\n${error.stack}`;
    } else {
      errorMessage = String(error);
    }
    postMessage({
      label: Md5FileWorkerLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
      index,
    });
  }
});
