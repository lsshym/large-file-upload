import { createFileChunks, generateFileHash, UploadHelper } from '../lib/main';
import axios from 'axios';
import { createRandomFile, testHashCollision } from './test';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <input type="file" id="fileInput" />
    <button id="pause">暂停</button>
    <button id="resume">恢复</button>
    <div>
      <button id="hashtest">测试hash碰撞</button>
    </div>

  </div>
`;
// 计时器函数


// 监听文件上传事件
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const btnPause = document.getElementById('pause') as HTMLInputElement;
const btnresume = document.getElementById('resume') as HTMLInputElement;

let testPool;

fileInput.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file) {
    const { fileChunks, chunkSize } = createFileChunks(file);
    const { hash: hashId } = await generateFileHash(file, chunkSize);

    const arr = fileChunks.map((chunk, index) => {
      return {
        chunk,
        index,
      };
    });

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
  }
});

btnPause.addEventListener('click', () => {
  testPool.pause();
});
btnresume.addEventListener('click', () => {
  testPool.resume();
});

const btnHashTest = document.getElementById('hashtest') as HTMLInputElement;

btnHashTest.addEventListener('click', async () => {
  testHashCollision();
});
