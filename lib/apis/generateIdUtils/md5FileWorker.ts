import { createMD5 } from 'hash-wasm';
import { Md5FileWorkerLabelsEnum } from './generateFileFingerprint';

self.addEventListener('message', async (event: MessageEvent) => {
  const { label, data, index }: { label: Md5FileWorkerLabelsEnum; data: ArrayBuffer[]; index: number } =
    event.data;

  try {
    switch (label) {
      case Md5FileWorkerLabelsEnum.DOING: {
        const chunkHashes = await Promise.all(
          data.map(async buffer => {
            const md5 = await createMD5();
            md5.init();
            md5.update(new Uint8Array(buffer));
            return md5.digest('hex');
          }),
        );

        postMessage({
          label: Md5FileWorkerLabelsEnum.DONE,
          data: chunkHashes,
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
