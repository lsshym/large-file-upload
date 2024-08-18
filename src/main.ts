import {
  uploadChunksWithPool,
  currentFileChunks,
  generateFileHashWithCrypto,
} from "../lib/main";
import axios from "axios";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <input type="file" id="fileInput" />
  </div>
`;
// 监听文件上传事件
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
fileInput.addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file) {
    // 创建文件切片，返回一个切片数组和每个切片的大小
    const { fileChunks, chunkSize } = await currentFileChunks(file);
    console.log(fileChunks, chunkSize);
    // 计算文件hash
    const hashId = await generateFileHashWithCrypto(file);
    console.log(hashId);

    const pool = uploadChunksWithPool({ fileChunks }, (chunk, index) => {
      const fd = new FormData();
      fd.append("fileHash", hashId);
      fd.append("chunkHash", `${hashId}-${index}`);
      fd.append("fileName", file.name);
      fd.append("chunkFile", chunk);
      return axios({
        url: "/upload",
        method: "post",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        data: fd, // 确保上传的内容正确传递
      });
    });
    // 可以获得已执行任务信息
    pool.status$.subscribe((status) => {
      console.log(`当前任务: ${status.currentTask}`);
    });
    // 开始任务
    pool.exec().then((values) => {
      // 任务完成后打印所以结果
      console.log("All tasks completed!", values);
    });
    // 暂停
    // pool.pause();
    // 重新开始
    // pool.resume();
  }
});
