import {
  currentFileChunks,
  generateFileHash,
  generateUUID,
  PromisePool,
  uploadChunksWithPool,
} from '../lib/main';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <input type="file" id="fileInput" />
  </div>
`;
// 计时器函数
async function startTimer(cb: Function, file: File, workerCount: number) {
  console.time(`${cb.name} time ${workerCount}`);
  const { hash: hashId } = await cb(file, workerCount);
  console.log('aborted', hashId, file.size / 1024 / 1024 / 1024);
  console.timeEnd(`${cb.name} time ${workerCount}`);
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
    console.log('begin');

    for (let i = 4; i < 20; i++) {
      await startTimer(generateFileHash, file, i);
      await startTimer(generateFileHash, file, i);
      await startTimer(generateFileHash, file, i);
    }

    return;
  }
});
