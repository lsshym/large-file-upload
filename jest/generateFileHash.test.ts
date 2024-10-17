import { generateFileHash } from '../lib/apis/generateIdUtils';

// 生成一个随机文件
function createRandomFile(size: number): File {
  const randomBytes = new Uint8Array(size);
  window.crypto.getRandomValues(randomBytes);
  return new File([randomBytes], 'random-file.bin', { type: 'application/octet-stream' });
}

describe('generateFileHash collision test', () => {
  const hashSet = new Set<string>();
  const testFileSize = 1024; // 每个文件 1 KB
  const numberOfTests = 1000;

  test('should not generate the same hash for 1000 random files', async () => {
    for (let i = 0; i < numberOfTests; i++) {
      const randomFile = createRandomFile(testFileSize);
      const hashResult = await generateFileHash(randomFile);

      // 检查 hash 是否已经存在于集合中
      if (hashSet.has(hashResult.hash)) {
        throw new Error(`Hash collision detected at iteration ${i}! Hash: ${hashResult.hash}`);
      }

      // 添加新的 hash 到集合中
      hashSet.add(hashResult.hash);
    }

    // 如果循环结束，没有抛出错误，表示测试通过
    expect(hashSet.size).toBe(numberOfTests);
  });
});
