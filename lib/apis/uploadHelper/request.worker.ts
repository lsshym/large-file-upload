import axios from 'axios';
import { RequestWorkerLabelsEnum } from './upload.helper.worker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let taskExecutor: any = null;

self.addEventListener('message', async (event: MessageEvent) => {
  const { label, data, arrayBuffer, index } = event.data;

  try {
    switch (label) {
      case RequestWorkerLabelsEnum.INIT: {
        taskExecutor = eval(data); // 执行传入的函数
        postMessage({
          label: RequestWorkerLabelsEnum.INITED,
        });
        break;
      }
      case RequestWorkerLabelsEnum.DOING: {
        console.log(11111111111);
        const uint8Array = new Uint8Array(arrayBuffer);
        const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
        const { index, hashId, fileName } = data;
        const fd = new FormData();
        console.log(22222222);
        fd.append('fileHash', hashId);
        fd.append('chunkHash', `${hashId}-${index}`);
        fd.append('fileName', fileName);
        fd.append('chunkFile', blob);
        console.log(22222222);
        axios({
          url: `api/upload`,
          method: 'post',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          data: fd, // 确保上传的内容正确传递
          // signal,
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
      label: RequestWorkerLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
      index,
    });
  }
});
