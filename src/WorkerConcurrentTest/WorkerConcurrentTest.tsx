/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileChunks, generateFileFingerprint } from '../../lib/main';
import testCon from './testCon.ts?worker';
export const WorkerConcurrentTest = () => {
  const fileInputChange = async (event: any) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      const { fileChunks } = createFileChunks(file);
      console.time('generateFileFingerprint');
      const hashId = await generateFileFingerprint(file);
      console.timeEnd('generateFileFingerprint');

      for (let i = 0; i < 5; i++) {
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
