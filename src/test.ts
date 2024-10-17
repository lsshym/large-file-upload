/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { generateFileHash } from '../lib/main';

export function createRandomFile(minSizeMB: number, maxSizeMB: number) {
  const chunkSize = 65536; // 每个块最大为 64 KB
  const sizeMB = Math.floor(Math.random() * (maxSizeMB - minSizeMB + 1)) + minSizeMB;
  const size = sizeMB * 1024 * 1024; // 将 MB 转换为字节
  const chunks = [];
  let remainingSize = size;

  while (remainingSize > 0) {
    const currentChunkSize = Math.min(chunkSize, remainingSize);
    const randomBytes = new Uint8Array(currentChunkSize);
    window.crypto.getRandomValues(randomBytes);
    chunks.push(randomBytes);
    remainingSize -= currentChunkSize;
  }

  // 合并所有块并创建文件
  const blob = new Blob(chunks);
  return new File([blob], `random-file-${sizeMB}MB.bin`, { type: 'application/octet-stream' });
}

// 示例使用：生成一个 1 到 10 MB 大小的随机文件
// const randomFile = createRandomFile(1, 10);
// 测试hash碰撞
export async function testHashCollision() {
  const hashSet = new Set<string>();
  let collisionDetected = false;

  for (let i = 0; i < 1000; i++) {
    // 生成一个随机文件，大小为 1 MB
    const randomFile = createRandomFile(1, 10);
    try {
      // 计算哈希值
      const { hash: hashId } = await generateFileHash(randomFile);

      // 检查是否有哈希碰撞
      if (hashSet.has(hashId)) {
        collisionDetected = true;
        console.error(`Hash collision detected at iteration ${i + 1}: ${hashId}`);
        break;
      }

      // 将哈希值加入集合
      hashSet.add(hashId);
    } catch (error) {
      console.error(`Error generating hash at iteration ${i + 1}: ${error}`);
    }
  }

  if (!collisionDetected) {
    console.log('No hash collisions detected after 1000 tests.');
  }
}

export async function startTimer(cb: Function, file: File, workerCount?: number) {
  console.time(`${cb.name} time`);
  const { hash: hashId } = await cb(file, workerCount);
  console.log('aborted', hashId);
  console.timeEnd(`${cb.name} time`);
  return hashId;
}
