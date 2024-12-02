import { createMD5 } from 'hash-wasm';

/**
 * Generates the MD5 hash of a file by reading it as a stream.
 * 
 * **Note:** This method is best suited for small files. 
 * For reference, processing a 1GB file takes approximately 5 seconds.
 * Performance may vary depending on the system and file size.
 * 
 * @param {File} file - The file to be hashed.
 * @returns {Promise<string>} A promise that resolves to the MD5 hash of the file in hexadecimal format.
 */
export async function generateFileMd5(file: File): Promise<string> {
  const hasher = await createMD5();

  const reader = file.stream().getReader();
  //TODO: 不知道怎么实现并发
  let done = false;
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    if (value) {
      hasher.update(value);
    }
    done = doneReading;
  }
  return hasher.digest('hex');
}
// export async function generateFileMd5(
//   file: File,
//   chunkSize: number = 1024 * 1024 * 10,
// ): Promise<string> {
//   const chunks = Math.ceil(file.size / chunkSize);
//   const hasher = await createMD5();

//   // 按顺序逐块计算哈希，保证顺序一致
//   for (let i = 0; i < chunks; i++) {
//     const start = i * chunkSize;
//     const end = Math.min(start + chunkSize, file.size);
//     const blob = file.slice(start, end);
//     await hashChunk(blob, hasher);
//   }

//   return hasher.digest('hex');
// }

// async function hashChunk(chunk: Blob, hasher: IHasher) {
//   const reader = chunk.stream().getReader();

//   let done = false;
//   while (!done) {
//     const result = await reader.read();
//     const { value, done: doneReading } = result;
//     if (value) {
//       hasher.update(value);
//     }
//     done = doneReading;
//   }
// }
