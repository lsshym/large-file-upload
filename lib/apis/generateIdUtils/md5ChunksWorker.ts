import { md5 } from 'hash-wasm';
import { Md5ChunksChannelLabelsEnum, Md5ChunksWorkerLabelsEnum } from './generateChunksHash';

self.addEventListener('message', (event: MessageEvent) => {
  const { label, port }: { label: Md5ChunksWorkerLabelsEnum; port: MessagePort } = event.data;
  try {
    switch (label) {
      case Md5ChunksWorkerLabelsEnum.INIT: {
        port.onmessage = hanleChannelMessage.bind(self, port);
        break;
      }
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
    port.postMessage({
      label: Md5ChunksWorkerLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
    });
  }
});

async function hanleChannelMessage(port: MessagePort, channelEvent: MessageEvent) {
  const {
    label,
    data,
  }: { label: Md5ChunksChannelLabelsEnum; data: { blob: Blob; index: number } } = channelEvent.data;
  try {
    switch (label) {
      case Md5ChunksChannelLabelsEnum.DOING: {
        const { blob, index } = data;
        const buffer = await blob.arrayBuffer();
        const hash = await md5(new Uint8Array(buffer));
        port.postMessage({
          label: Md5ChunksChannelLabelsEnum.DONE,
          data: hash,
          index,
        });
      }
    }
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = `${error.message}\n${error.stack}`;
    } else {
      errorMessage = String(error);
    }
    port.postMessage({
      label: Md5ChunksChannelLabelsEnum.ERROR,
      data: errorMessage, // 发送错误信息字符串
    });
  }
}
