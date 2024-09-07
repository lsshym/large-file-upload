import {
  currentFileChunks,
  generateFileHash,
  generateFileHashWithArrayBuffer,
  generateUUID,
  PromisePool,
  uploadChunksWithPool,
} from '../lib/main';
import axios from 'axios';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <input type="file" id="fileInput" />
  </div>
`;
// 监听文件上传事件
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file) {
    // 创建文件切片，返回一个切片数组和每个切片的大小
    const { fileChunks, chunkSize } = await currentFileChunks(file);

    console.time('generateFileHashWithCrypto');
    const { hash: hashId } = await generateFileHash(file);
    // const value = await generateSmallFileHash(file);

    console.log('aborted', hashId);
    console.timeEnd('generateFileHashWithCrypto');
    // const hashId = await generateFileHashWithCrypto(file);
    // const id = setInterval(() => {
    //   console.log(Math.random());
    // }, 0);
    // clearInterval(id);
    return;
    // console.log("hashId", hashId);
    const pool = uploadChunksWithPool({ fileChunks }, (chunk, index) => {
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
        data: fd, // 确保上传的内容正确传递
      });
    });
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
    pool.exec().then((values) => {
      // 任务完成后打印所以结果
      console.log('All tasks completed!', values);
    });
    // console.log('777777777777777777777777')
    // 暂停
    // pool.pause();
    // 重新开始
    // pool.resume();
  }
});
