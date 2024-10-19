/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileChunks, generateFileHash, UploadHelper } from '../../lib/main';

import axios from 'axios';
import { useRef } from 'preact/hooks';

export const UploadTest = () => {
  const uploadRef: any = useRef();
  const fileInputChange = async (event: any) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      const { fileChunks, chunkSize } = createFileChunks(file);
      const { hash: hashId } = await generateFileHash(file, chunkSize);

      const arr = fileChunks.map((chunk, index) => {
        return {
          chunk,
          index,
          fileName: file.name,
          hashId,
        };
      });

      console.time('uploadRef');
      uploadRef.current = new UploadHelper(arr);
      uploadRef.onProgressChange((value: any) => {
        console.log(value);
      });
      uploadRef
        .run(async ({ data, signal }: { data: any; signal: AbortSignal }) => {
          const { chunk, index } = data;
          const fd = new FormData();
          fd.append('fileHash', hashId);
          fd.append('chunkHash', `${hashId}-${index}`);
          fd.append('fileName', file.name);
          fd.append('chunkFile', chunk);
          return await axios({
            url: `api/upload`,
            method: 'post',
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            data: fd, // 确保上传的内容正确传递
            signal,
          });
        })
        .then(({ results, errorTasks }: any) => {
          console.log(results, errorTasks);
          console.timeEnd('uploadRef');
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
