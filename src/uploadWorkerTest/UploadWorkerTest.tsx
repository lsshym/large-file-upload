/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileChunks, generateFileHash, UploadWorkerHelper } from '../../lib/main';

import axios from 'axios';
import { useRef } from 'preact/hooks';

export const UploadWorkerTest = () => {
  const uploadRef: any = useRef();
  const fileInputChange = async (event: any) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      const { fileChunks, chunkSize } = createFileChunks(file);
      console.time('generateFileHash');
      const { hash: hashId } = await generateFileHash(file, chunkSize);
      console.timeEnd('generateFileHash');
      const arr = fileChunks.map((chunk, index) => {
        return {
          chunk,
          chunkHash: `${hashId}-${index}`,
          fileName: file.name,
          fileHash: hashId,
        };
      });
      console.time('uploadRefWorker');
      uploadRef.current = new UploadWorkerHelper(arr, {
        maxConcurrentTasks: 5,
      });

      uploadRef.current
        .run({
          url: '/api/upload',
          method: 'post',
          format: {
            chunk: 'chunkFile',
          },
        })
        .then(({ results, errorTasks }: any) => {
          console.log(results, errorTasks);
          console.timeEnd('uploadRefWorker');
          axios({
            url: `api/merge`,
            method: 'post',
            data: {
              chunkSize: chunkSize * 1024 * 1024,
              fileName: file.name,
              fileHash: hashId,
            },
          });
        });
    }
  };

  return (
    <div>
      worker上传
      <div>
        <input type="file" onChange={fileInputChange} />
        <button
          onClick={() => {
            uploadRef.current.pause();
          }}
        >
          暂停
        </button>
        <button
          onClick={() => {
            uploadRef.current.resume();
          }}
        >
          恢复
        </button>
      </div>
    </div>
  );
};
