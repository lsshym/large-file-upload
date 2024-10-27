import axios from 'axios';

const func = async () => {
  // 生成一个5M的blob
  const blob = new Blob([new ArrayBuffer(1 * 1024 * 1024)], { type: 'application/octet-stream' });
  // 上传blob
  await axios({
    url: `/api/test`,
    method: 'post',
    data: blob,
  });
  func();
};

self.addEventListener('message', async () => {
  func();
});
