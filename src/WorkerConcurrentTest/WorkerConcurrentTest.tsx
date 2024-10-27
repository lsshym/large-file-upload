/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileChunks, generateFileHash } from '../../lib/main';
import testCon from './testCon.ts?worker';
export const WorkerConcurrentTest = () => {
  const fileInputChange = async (event: any) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      const { fileChunks, chunkSize } = createFileChunks(file);
      console.time('generateFileHash');
      const { hash: hashId } = await generateFileHash(file, chunkSize);
      console.timeEnd('generateFileHash');

      for (let i = 0; i < 6; i++) {
        const tes = new testCon();
        const channel = new MessageChannel();
        channel.port2.onmessage = event => {
          const { label } = event.data;
          if (label === 'done') {
            channel.port2.postMessage({
              label: 'req',
              data: {
                chunkFile: fileChunks[0],
                chunkHash: `${hashId}-${Math.random()}`,
                fileName: file.name,
                fileHash: hashId,
              },
            });
          }
        };
        tes.postMessage(
          {
            port: channel.port1,
          },
          [channel.port1],
        );
        channel.port2.postMessage({
          label: 'req',
          data: {
            chunkFile: fileChunks[0],
            chunkHash: `${hashId}-${Math.random()}`,
            fileName: file.name,
            fileHash: hashId,
          },
        });
      }
    }
  };

  return (
    <div>
      worker并发能性能测试
      <div>
        <input type={'file'} onChange={fileInputChange}>
          dianwo
        </input>
      </div>
    </div>
  );
};
