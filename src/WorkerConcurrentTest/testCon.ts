import axios from 'axios';

const func = async () => {
  // 生成一个5M的blob
  //   fd.append('fileHash', hashId);
  //   fd.append('chunkHash', `${hashId}-${index}`);
  //   fd.append('fileName', file.name);
  //   fd.append('chunkFile', chunk);
  // 上传blob
  await axios({
    url: `/api/test`,
    method: 'post',
    data: blob,
  });
  func();
};
let portChannel: MessagePort;
self.addEventListener('message', async event => {
  //   func();
  const { port } = event.data;
  portChannel = port;
  portChannel.onmessage = async event => {
    const { label, data } = event.data;
    switch (label) {
      case 'req': {
        const { chunkFile, chunkHash, fileName, fileHash } = data;

        const fd = new FormData();
        fd.append('fileHash', fileHash);
        fd.append('chunkHash', chunkHash);
        fd.append('fileName', fileName);
        fd.append('chunkFile', chunkFile);
        const response = await fetch('/api/upload', {
          method: 'post',
          body: fd, // 确保传递的表单数据
        });
        portChannel.postMessage({
          label: 'done',
        });
        return response.json();
      }
    }
  };
});
