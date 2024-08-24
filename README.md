
# FileChunkTools

FileChunkTools is a TypeScript-based utility library designed to handle file chunking, hashing, and concurrent upload tasks using a promise pool. This library is useful for scenarios where large files need to be split into chunks for processing or uploading in parallel.

## Features

- **File Chunking**: Split large files into smaller chunks for easier processing or uploading.
- **File Hashing**: Generate a unique hash identifier for a file, which can include extra parameters.
- **Concurrent Upload**: Upload file chunks concurrently using a promise pool to control the number of simultaneous tasks.

## Installation

To install this library, clone the repository and install dependencies using pnpm:

```bash
git clone https://github.com/lsshym/FileChunkTools.git
cd FileChunkTools
pnpm install
```

## Usage

Below are detailed descriptions of the functions available in the library and how to use them.

### 1. `currentFileChunks(file: File, customChunkSize?: number): Promise<FileChunkResult>`

#### Description
Splits the given file into multiple chunks of the specified size. If `customChunkSize` is not provided, the function automatically determines the chunk size based on the file size.

#### Parameters
- `file`: The file to be split.
  - **Type**: `File`
  - **Required**: Yes

- `customChunkSize`: Custom size of each chunk (in MB). If the value is less than 1 or is not a valid number, the default size is 4MB. If the value is not an integer, it is rounded down.
  - **Type**: `number`
  - **Required**: No

#### Returns
- **Type**: `Promise<FileChunkResult>`
- **Description**: Returns an object with the following properties:
  - `fileChunks`: An array of `Blob` objects, each representing a chunk of the file.
  - `chunkSize`: The size of each chunk (in bytes).
  - `error`: Optional error message.

#### Example
```typescript
const file = document.querySelector('input[type="file"]').files[0];
const { fileChunks, chunkSize } = await currentFileChunks(file, 2);

console.log('Chunk Size:', chunkSize);
console.log('Number of Chunks:', fileChunks.length);
```

### 2. `generateFileHashWithCrypto(file: File, extraParams?: Record<string, any>): Promise<string>`

#### Description
Generates a unique hash identifier for the file using Crypto, based on the file content and optional extra parameters. The return value is formatted in a UUID-like form (8-4-4-4-12).

#### Parameters
- `file`: The file object for which to generate the hash.
  - **Type**: `File`
  - **Required**: Yes

- `extraParams`: Optional extra parameters object, which will be included in the hash computation along with the file content.
  - **Type**: `Record<string, any>`
  - **Required**: No

#### Returns
- **Type**: `Promise<string>`
- **Description**: Returns a Promise that resolves to the formatted hash value (in UUID form).

#### Example
```typescript
const file = document.querySelector('input[type="file"]').files[0];
const hash = await generateFileHashWithCrypto(file, { userId: '12345' });

console.log('File Hash:', hash);
```

### 3. `uploadChunksWithPool(options: UploadOptions, cb: UploadCallback): PromisePool`

#### Description
Controls the concurrent upload of file chunks using `PromisePool`.

#### Parameters
- `options`: Upload options, including the array of file chunks and the maximum number of concurrent tasks.
  - **Type**: `UploadOptions`
  - **Required**: Yes
  - **Properties**:
    - `fileChunks`: An array of file chunks to be uploaded.
      - **Type**: `FileChunk[]`
      - **Required**: Yes
    - `maxTasks`: The maximum number of concurrent upload tasks, default is 4.
      - **Type**: `number`
      - **Required**: No

- `cb`: Callback function to handle the upload of a single file chunk.
  - **Type**: `(item: FileChunk, index: number) => Promise<any>`
  - **Required**: Yes

#### Returns
- **Type**: `PromisePool`
- **Description**: Returns a `PromisePool` instance that manages the execution of the tasks.

#### Example
```typescript
const file = document.querySelector('input[type="file"]').files[0];
const { fileChunks } = await currentFileChunks(file, 2);

const uploadCallback = async (chunk, index) => {
  // Simulate an upload function
  console.log(\`Uploading chunk \${index + 1}...\`);
  return new Promise((resolve) => setTimeout(resolve, 1000));
};

const pool = uploadChunksWithPool({ fileChunks, maxTasks: 3 }, uploadCallback);
pool.exec().then((results) => {
  console.log('All chunks uploaded successfully.');
});
```

### 4. `PromisePool`

#### Description
A class that manages the concurrent execution of asynchronous tasks, allowing you to control the number of tasks running simultaneously.

#### Constructor
```typescript
constructor(functions: AsyncFunction[], maxConcurrentTasks: number)
```

#### Parameters
- `functions`: Array of asynchronous functions to be executed.
  - **Type**: `AsyncFunction[]`
  - **Required**: Yes

- `maxConcurrentTasks`: Maximum number of concurrent tasks, default is the number of CPU cores.
  - **Type**: `number`
  - **Required**: No

#### Methods

- **`exec<T>(): Promise<T[]>`**: Executes all asynchronous functions in the task pool and returns a Promise array containing the results of all tasks.

- **`pause()`**: Pauses task execution.

- **`resume()`**: Resumes task execution.

- **`clear()`**: Clears the task queue.

- **`addTasks(newTasks: AsyncFunction[])`**: Adds new tasks to the queue.

#### Example
```typescript
const tasks = [
  () => new Promise((resolve) => setTimeout(() => resolve('Task 1'), 1000)),
  () => new Promise((resolve) => setTimeout(() => resolve('Task 2'), 2000)),
  () => new Promise((resolve) => setTimeout(() => resolve('Task 3'), 1500)),
];

const pool = new PromisePool(tasks, 2);

pool.exec().then((results) => {
  console.log('Results:', results);
});

pool.pause();
setTimeout(() => pool.resume(), 3000);
```

## License

This project is licensed under the MIT License.
