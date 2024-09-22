import {
  currentFileChunks,
  generateFileHash,
  PromisePool,
  uploadChunksWithPool,
} from '../lib/main';
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
  console.time(`${cb.name} time ${workerCount}`);
  const { hash: hashId } = await cb(file, workerCount);
  console.log('aborted', hashId, file.size / 1024 / 1024 / 1024);
  console.timeEnd(`${cb.name} time ${workerCount}`);
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
    const { fileChunks, chunkSize } = currentFileChunks(file);
    // startTimer(generateFileHash, file);
    const hashId = '6666666666';
    console.log(fileChunks.length)
    const arr = fileChunks.map((chunk, index) => {
      return async ({ signal }) => {
        const fd = new FormData();
        fd.append('fileHash', hashId);
        fd.append('chunkHash', `${hashId}-${index}`);
        fd.append('fileName', file.name);
        fd.append('chunkFile', chunk);
        const value = await axios({
          url: `api/upload`,
          method: 'post',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          data: fd, // 确保上传的内容正确传递
          signal,
        }).catch(error => {
          console.log(error);
        });
        return value;
      };
    });
    testPool = new PromisePool(arr);
    testPool.exec().then(value => {
      console.log(value);
      axios({
        url: `api/merge`,
        method: 'post',
        data: {
          chunkSize: chunkSize,
          fileName: file.name,
          fileHash: hashId,
        },
      });
    });
    // testPool.pause();

    // setTimeout(() => {
    // }, 1000);
    // console.log("hashId", hashId);
    // const pool = uploadChunksWithPool({ fileChunks }, (chunk, index) => {
    //   const fd = new FormData();
    //   // fd.append("fileHash", hashId);
    //   // fd.append("chunkHash", `${hashId}-${index}`);
    //   // fd.append("fileName", file.name);
    //   // fd.append("chunkFile", chunk);
    //   // return axios({
    //   //   url: `api/upload`,
    //   //   method: "post",
    //   //   headers: {
    //   //     "Content-Type": "multipart/form-data",
    //   //   },
    //   //   data: fd, // 确保上传的内容正确传递
    //   // });
    // });
    // 可以获得已执行任务信息
    // pool.status$.subscribe((status) => {
    //   console.log(`当前任务: ${status.currentTask}`);
    // });

    // const task1 = () =>
    //   new Promise((resolve) =>
    //     setTimeout(() => resolve("Task 1 completed"), 1000)
    //   );
    // const task2 = () =>
    //   new Promise((resolve) =>
    //     setTimeout(() => resolve("Task 2 completed"), 2000)
    //   );
    // const task3 = () =>
    //   new Promise((resolve) =>
    //     setTimeout(() => resolve("Task 3 completed"), 1500)
    //   );
    // const task4 = () =>
    //   new Promise((resolve) =>
    //     setTimeout(() => resolve("Task 4 completed"), 500)
    //   );
    // const pool = new PromisePoolTest([task1, task2, task3, task4], 2);
    // 开始任务
    // console.log('6666666666666666666666666666666666')
    // pool.exec().then((values) => {
    //   // 任务完成后打印所以结果
    //   console.log("All tasks completed!", values);
    // });
    // console.log('777777777777777777777777')
    // 暂停
    // pool.pause();
    // 重新开始
    // pool.resume();
    return;
  }
});
btnPause.addEventListener('click', () => {
  testPool.pause();
});
btnresume.addEventListener('click', () => {
  testPool.resume();
});
