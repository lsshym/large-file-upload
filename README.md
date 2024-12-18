# large-file-upload

`large-file-upload` is a powerful and flexible library designed to handle the splitting, processing, and uploading of large files in chunks.

## Table of Contents

- [large-file-upload](#large-file-upload)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Using with Vite](#using-with-vite)
  - [API Reference](#api-reference)
    - [`createFileChunks`](#createfilechunks)
    - [`generateUUID`](#generateuuid)
    - [`generateFileMd5`](#generatefilemd5)
    - [`generateFileFingerprint`](#generatefilefingerprint)
    - [`TaskQueueManager`](#taskqueuemanager)
    - [`generateChunksHash`](#generatechunkshash)
  - [Examples](#examples)
    - [Example: Splitting a File](#example-splitting-a-file)
    - [Example: Generating a File Hash in Chunks](#example-generating-a-file-hash-in-chunks)
    - [Example: Uploading](#example-uploading)
    - [Example: Pausing, Resuming, and Canceling Uploads](#example-pausing-resuming-and-canceling-uploads)
  - [License](#license)

## Installation

To install the `large-file-upload` library, use the following command:

```bash
npm install large-file-upload
```

## Using with Vite

If you are using Vite in your project, you may encounter issues with Vite's dependency optimization process. To resolve this, you need to explicitly exclude `large-file-upload` from the Vite optimization step. Add the following to your `vite.config.ts`:

```typescript
export default defineConfig({
  optimizeDeps: {
    exclude: ["large-file-upload"],
  },
});
```


## API Reference

### `createFileChunks`

Splits the given file into multiple chunks of the specified size.

**Parameters**:

- `file: File` - The file to be split.
- `customChunkSize?: number` - Custom size of each chunk (in MB). If not provided, the function automatically determines the chunk size.

**Returns**:

- `Promise<FileChunkResult>` - An object containing the file chunks and chunk size.

### `generateUUID`

Generates a UUID (Universally Unique Identifier).

**Parameters**:

 - `any` args - The input parameters used to generate the UUID.
 
**Returns**:

- `string` A UUID string generated from the input.

### `generateFileMd5`

Generates the MD5 hash

**Parameters**:

 - `file` args - The file to be hashed.
 
**Returns**:

- `Promise<string>` AA promise that resolves to the MD5 hash of the file in hexadecimal format.


### `generateFileFingerprint`

Calculates the hash of the given file in chunks.

**Parameters**:

- `file: File` - The file for which to generate the hash.

**Returns**:

- `Promise<string>` - A promise that resolves to an object containing the hash and chunk size.

### `TaskQueueManager`

A utility class to manage and control the upload of file chunks with support for concurrency, retries, pausing, resuming, and canceling uploads.

**Constructor Parameters**:

- `tasksData: T[]` - An array of task data (e.g., file chunks) to be uploaded.
- `options?: UploadHelperOptions` - Optional settings for controlling the upload:
  - `maxConcurrentTasks?: number` - Maximum number of concurrent uploads (default: 5).
  - `lowPriority?: boolean` - **Whether to use low priority mode to improve main thread performance (default: false)**.
  - `maxRetries?: number` - Maximum number of retries for a failed task (default: 3).
  - `retryDelay?: number` - Delay between retries in milliseconds (default: 1000 ms).

**Methods**:

- `run(func: AsyncFunction<T, R>): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }>`: Executes the upload tasks in the queue with the provided async function for processing each chunk.

- `pause(): void`: Pauses the ongoing uploads. Ongoing tasks are aborted, and pending tasks remain in the queue.

- `resume(): void`: Resumes paused uploads from where they left off.

- `retryTasks(tasks: Task<T>[]): Promise<{ results: (R | Error)[]; errorTasks: Task<T>[] }>`: Retries the specified tasks.

- `clear(): void`: Cancels all ongoing and pending uploads and clears the task queue.

- `onProgressChange(callback: (index: number) => void): void`: Sets a callback function to monitor the progress of the tasks.

**Notes**:

- **Concurrency Control**: `TaskQueueManager` manages the concurrency of task execution based on the `maxConcurrentTasks` option.

- **Retry Mechanism**: Failed tasks are retried based on the `maxRetries` and `retryDelay` options.

- **Progress Tracking**: You can track the progress of the tasks using the `onProgressChange` method.

### `generateChunksHash`

Calculates the MD5 hashes of the provided file chunks in parallel using Web Workers.

**Parameters**:

- `blobArr: Blob[]` - Array of file chunks as Blob objects.

**Returns**:

- `Promise<string[]>` - A promise that resolves to an array of MD5 hashes for each chunk.

## Examples

### Example: Splitting a File

This example demonstrates how to use the `createFileChunks` function to split a file into multiple chunks.

```typescript
import { createFileChunks } from 'large-file-upload';

async function splitFile(file: File) {
  const { fileChunks, chunkSize } = await createFileChunks(file);
  console.log('File has been split into', fileChunks.length, 'chunks of size', chunkSize);
}
````

### Example: Generating a File Hash in Chunks

This example shows how to generate a hash for a large file using the `generateFileFingerprint` function.

```typescript
import { generateFileFingerprint } from 'large-file-upload';

async function hashLargeFile(file: File) {
  const hash = await generateFileFingerprint(file);
  console.log('Generated hash for the large file:', hash);
}
```

### Example: Uploading

This example demonstrates how to use `TaskQueueManager` to upload file chunks with concurrency control and retries.

```typescript
import { TaskQueueManager, createFileChunks } from 'large-file-upload';

async function uploadFile(file: File) {
  const { fileChunks } = await createFileChunks(file);
  const uuid = await generateUUID(file.size, file.name);

  const fileArr = fileChunks.map((chunk, index) => {
    return {
      blob: chunk,
      index,
    };
  });
  const uploadHelper = new TaskQueueManager(fileArr, {
    maxConcurrentTasks: 3,
  });

  uploadHelper.onProgressChange(progress => {
    console.log(`Progress: ${progress}/${fileChunks.length}`);
  });

  // Execute the upload tasks with an async function passed to run
  const { results, errorTasks } = await uploadHelper.run(async ({ data, signal }) => {
    const formData = new FormData();
    formData.append('chunk', data.blob);
    formData.append('index', data.index);
    formData.append('uploadId', uuid);
    // Simulate an upload request using fetch or any HTTP client
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    return await response.json();
  });

  if (errorTasks.length > 0) {
    console.log('Some chunks failed to upload:', errorTasks);
    // Optionally retry failed tasks
    // await uploadHelper.retryTasks(errorTasks);
  } else {
    console.log('All chunks uploaded successfully');
  }
}
```

### Example: Pausing, Resuming, and Canceling Uploads

This example demonstrates how to pause, resume, and cancel uploads using the `TaskQueueManager`.

```typescript
import { TaskQueueManager } from 'large-file-upload';

// Assuming uploadHelper is already initialized and running

// Pausing the uploads
uploadHelper.pause();

// Resuming the uploads
uploadHelper.resume();

// Canceling all ongoing and pending uploads
uploadHelper.clear();
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
