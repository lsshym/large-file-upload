import { generateFileHashTest } from '../lib/apis/generateIdUtils';
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
// 计时器函数
async function startTimer(cb: Function, file: File) {
  console.time(`${cb.name} time`);
  const { hash: hashId } = await cb(file);
  console.log('aborted', hashId, file.size / 1024 / 1024 / 1024);
  console.timeEnd(`${cb.name} time`);
  return hashId;
}
// 监听文件上传事件
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file) {
    // 创建文件切片，返回一个切片数组和每个切片的大小
    // const { fileChunks, chunkSize } = await currentFileChunks(file);

    // md5耗时，单线程
    startTimer(generateFileHash, file);
    startTimer(generateFileHashTest, file);

    return;
   
  }
});
