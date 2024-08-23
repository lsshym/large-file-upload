# 文件上传工具库

这个库提供了一组用于处理文件上传的实用工具，包括文件切片、哈希生成和使用 Promise Pool 管理并发上传。其主要目的是通过将大文件拆分为小块并高效管理上传过程，方便大文件的上传。

## 功能特点

- **文件切片:** 将大文件拆分为更小的块，便于上传。
- **文件哈希:** 为文件生成唯一的哈希值，用于在上传过程中标识文件。
- **并发上传管理:** 通过控制最大并发数，实现文件块的并发上传。

## 安装

在项目中安装此库：

```bash
npm install file-chunks-tools
```

## API 文档

#### currentFileChunks

将文件按指定大小分割成多个块。

```
const { fileChunks, chunkSize } = await currentFileChunks(file);
```

#### generateFileHashWithCrypto

计算 hash。

```
const hashId = await generateFileHashWithCrypto(file);
```

#### uploadChunksWithPool

将切片文件数组添加到 Promise 控制池，控制最大并发数量，防止浏览器卡顿。

```
const pool = uploadChunksWithPool(
  { fileChunks },
  (chunk, index) => {
    const fd = new FormData();
    fd.append("fileHash", hashId);
    return axios({
      url: "/upload",
      method: "post",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      data: fd, // 确保上传的内容正确传递
    });
  }
);

// 监听任务状态
pool.status$.subscribe((status) => {
  console.log(`当前任务: ${status.currentTask}`);
});

// 开始任务
pool.exec().then((values) => {
  // 任务完成后打印所有结果
  console.log("All tasks completed!", values);
});
```

#### PromisePool 线程池

可自行控制并发数量，可用于控制同时发起的请求数量。

```
  import { PromisePool } from "file-chunks-tools";
  const tasks = Array.from({ length: 10 }, (_, index) => {
    return async () => {

    };
  });
  const pool = new PromisePool(tasks, maxTasks);
  pool.exec().then((values) => {

  });
  pool.status$.subscribe((status) => {

  });
  <!-- 暂停 -->
  pool.pause();
  <!-- 继续 -->
  pool.resume();
  <!-- 清空 -->
  pool.clear();
```
