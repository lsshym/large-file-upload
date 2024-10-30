/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileChunks, generateFileHash, UploadHelper } from '../../lib/main';

import axios from 'axios';
import { useRef } from 'preact/hooks';
import pLimit from 'p-limit';

export const UploadTest = () => {
  const uploadRef: any = useRef();

  const fileInputChange = async (event: any) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    // const limit = pLimit(5); // 设置并发限制为5

    if (file) {
      const { fileChunks, chunkSize } = createFileChunks(file);
      console.time('generateFileHash');
      const { hash: hashId } = await generateFileHash(file, chunkSize);
      console.timeEnd('generateFileHash');
      const arr = fileChunks.map((chunk, index) => {
        return {
          chunk,
          index,
        };
      });

      console.time('uploadRef');
      uploadRef.current = new UploadHelper(arr, {
        maxConcurrentTasks: 5,
        lowPerformance: true,
      });
      uploadRef.current.onProgressChange((value: any) => {
        console.log(value);
      });
      uploadRef.current
        .run(async ({ data, signal }: any) => {
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
      // const uploadPromises = arr.map(({ chunk, index }) => {
      //   return limit(async () => {
      //     const fd = new FormData();
      //     fd.append('fileHash', hashId);
      //     fd.append('chunkHash', `${hashId}-${index}`);
      //     fd.append('fileName', file.name);
      //     fd.append('chunkFile', chunk);

      //     return await axios({
      //       url: `api/upload`,
      //       method: 'post',
      //       headers: {
      //         'Content-Type': 'multipart/form-data',
      //       },
      //       data: fd,
      //     });
      //   });
      // });

      // // 运行所有上传任务
      // Promise.all(uploadPromises)
      //   .then(results => {
      //     console.log(results);
      //     console.timeEnd('uploadRef');
      //     // 合并文件
      //     return axios({
      //       url: `api/merge`,
      //       method: 'post',
      //       data: {
      //         chunkSize: chunkSize * 1024 * 1024,
      //         fileName: file.name,
      //         fileHash: hashId,
      //       },
      //     });
      //   })
      //   .then(mergeResponse => {
      //     console.log('Merge response:', mergeResponse);
      //   })
      //   .catch(error => {
      //     console.error('Upload error:', error);
      //   });
    }
  };

  return (
    <div>
      主线程上传
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
