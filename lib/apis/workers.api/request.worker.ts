import { Md5WorkerLabelsEnum } from '../generateIdUtils';

self.addEventListener('message', async (event: MessageEvent) => {
  const { label, data, index }: { label: Md5WorkerLabelsEnum; data: ArrayBuffer[]; index: number } =
    event.data;

  try {
    switch (label) {
      case Md5WorkerLabelsEnum.DOING: {
      
        postMessage({
          label: Md5WorkerLabelsEnum.DONE,
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
      label: Md5WorkerLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
      index,
    });
  }
});
