/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createFileChunks,
  generateChunksHash,
  generateFileFingerprint,
  UploadHelper,
} from '../../lib/main';
import { createMD5 } from 'hash-wasm';

import axios from 'axios';
import { useRef } from 'preact/hooks';
import { generateFileHashInChunks, generateFileHashTest } from '../../lib/apis/generateIdUtils/generateUUID';
import { generateFileMd5 } from '../../lib/apis/generateIdUtils/generateFileMd5';

export const UploadTest = () => {
  const uploadRef: any = useRef();

  const fileInputChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] as File;

    if (file) {
      const { fileChunks, chunkSize } = createFileChunks(file);
      // console.time('generateFileFingerprint');
      // const hashId = await generateFileFingerprint(file);
      // console.log(hashId)
      // console.timeEnd('generateFileFingerprint');
      console.time('generateFileHash2');
      const hashId2 = await generateFileMd5(file);
      console.timeEnd('generateFileHash2')
      console.log(hashId2)
      // console.time('111');
      // const v1 = await file.arrayBuffer();
      // console.timeEnd('111');
      // console.time('2222');
      // const v2 = await md5(new Uint8Array(v1));
      // console.timeEnd('2222');
      // console.log(v2)
      // console.time('MD5 Calculation');
      // const md5 = await calculateMD5WithHashWasm(file);
      // console.timeEnd('MD5 Calculation');
      // console.log(md5)
      return;
      console.time('generateChunksHash');
      const value = await generateChunksHash(fileChunks);
      console.timeEnd('generateChunksHash');
      console.log(value);
      const arr = fileChunks.map((chunk, index) => {
        return {
          chunk,
          index,
        };
      });

      console.time('uploadRef');
      const test = new UploadHelper(arr, {
        maxConcurrentTasks: 5,
        lowPriority: true,
      });
      test.onProgressChange((value: any) => {
        console.log(value);
      });
      test
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


async function calculateMD5WithHashWasm(file) {
  // 创建 MD5 哈希计算器
  const hasher = await createMD5();
  
  const chunkSize = 64 * 1024; // 64KB 每块读取
  let currentPosition = 0;
  const totalSize = file.size;

  // 分块读取文件并计算哈希
  while (currentPosition < totalSize) {
    const slice = file.slice(currentPosition, currentPosition + chunkSize);
    const buffer = await slice.arrayBuffer(); // 获取当前块的 ArrayBuffer

    // 将当前块的数据添加到哈希计算器中
    // hasher.update(new Uint8Array(buffer));

    currentPosition += chunkSize; // 更新当前读取的位置
  }

  // 完成哈希计算并获取结果
  // const md5Hash = await hasher.digest();
  
  // return md5Hash; // 返回计算得到的 MD5 值
  return '1111'; // 返回计算得到的 MD5 值
}


