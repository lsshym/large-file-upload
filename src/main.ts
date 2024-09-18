import {
  currentFileChunks,
  generateFileHash,
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
//     data: ${data} 8e6c4fe2ffc51ea7d2d5b0f5d6f72126
// main.ts:21 aborted 8e6c4fe2ffc51ea7d2d5b0f5d6f72126 1.1640969309955835
// main.ts:22 generateFileHash time: 5981.971923828125 ms
    startTimer(generateFileHash, file);
//     main.ts:21 aborted d5c10a80858819ae82c5cdbcca6a0293 1.1640969309955835
// main.ts:22 generateFileHashTest time: 3366.786865234375 ms
    // startTimer(generateFileHashTest, file);
//     main.ts:21 aborted df6372c8e2408ec769db6f0ad422f0d17230da6558402447c1fd9098b581db37 1.1640969309955835
// main.ts:22 generateFileHashBlake3 time: 6564.705810546875 ms
    // startTimer(generateFileHashBlake3, file);

    return;
   
  }
});
