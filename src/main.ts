import {
  currentFileChunks,
  generateFileHash,
  UploadFileTool,
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
    startTimer(generateFileHash, file);

    return
    const hashId = '6666666666';
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
    testPool = new UploadFileTool(arr);
    testPool.setIndexChangeListener((value)=>{
      console.log(value);
    })
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
    return;
  }
});
btnPause.addEventListener('click', () => {
  testPool.pause();
});
btnresume.addEventListener('click', () => {
  testPool.resume();
});
