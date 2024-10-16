import { createFileChunks, generateFileHash, UploadHelper } from '../lib/main';
import axios from 'axios';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <input type="file" id="fileInput" />
    <button id="pause">暂停</button>
    <button id="resume">恢复</button>
  </div>
`;
// 计时器函数
async function startTimer(cb: Function, file: File, workerCount?: number) {
  console.time(`${cb.name} time`);
  const { hash: hashId } = await cb(file, workerCount);
  console.log('aborted', hashId, file.size / 1024 / 1024 / 1024);
  console.timeEnd(`${cb.name} time`);
  return hashId;
}
// 监听文件上传事件
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const btnPause = document.getElementById('pause') as HTMLInputElement;
const btnresume = document.getElementById('resume') as HTMLInputElement;
let testPool;

fileInput.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file) {
    // 创建文件切片，返回一个切片数组和每个切片的大小
    const { fileChunks, chunkSize } = createFileChunks(file);
    // startTimer(generateFileHash, file);
    const { hash: hashId } = await generateFileHash(file, chunkSize);
    const arr = fileChunks.map((chunk, index) => {
      return {
        chunk,
        index,
      };
    });
    console.log('arr', arr.length);

    console.time('testPool');
    testPool = new UploadHelper(arr);
    // testPool.onProgressChange(value => {
    //   console.log(value);
    // });
    testPool
      .run(async ({ data, signal }) => {
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
      .then(({ results, errorTasks }) => {
        console.log(results, errorTasks);
        console.timeEnd('testPool');
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
    return;
    console.time('limitConcurrencyPool');
    const uploadTasks = arr.map(({ chunk, index }) => () => {
      const fd = new FormData();
      fd.append('fileHash', hashId);
      fd.append('chunkHash', `${hashId}-${index}`);
      fd.append('fileName', file.name);
      fd.append('chunkFile', chunk);

      return axios({
        url: `api/upload`,
        method: 'post',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        data: fd,
      });
    });

    limitConcurrency(uploadTasks, 6)
      .then(() => {
        console.timeEnd('limitConcurrencyPool');
        axios({
          url: `api/merge`,
          method: 'post',
          data: {
            chunkSize: chunkSize * 1024 * 1024,
            fileName: file.name,
            fileHash: hashId,
          },
        });
      })
      .catch(error => {
        console.log(error);
      });
  }
});

btnPause.addEventListener('click', () => {
  testPool.pause();
});
btnresume.addEventListener('click', () => {
  testPool.resume();
});
function limitConcurrency(tasks: (() => Promise<any>)[], concurrency: number): Promise<any[]> {
  const results: any[] = [];
  let runningCount = 0;
  let currentIndex = 0;

  return new Promise((resolve, reject) => {
    function runTask() {
      if (currentIndex >= tasks.length) {
        if (runningCount === 0) {
          resolve(results);
        }
        return;
      }

      while (runningCount < concurrency && currentIndex < tasks.length) {
        const taskIndex = currentIndex++;
        runningCount++;
        tasks[taskIndex]()
          .then(result => {
            results[taskIndex] = result;
          })
          .catch(reject)
          .finally(() => {
            runningCount--;
            runTask();
          });
      }
    }

    runTask();
  });
}
