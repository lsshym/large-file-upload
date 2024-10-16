# large-file-upload

large-file-upload is a powerful and flexible library designed to handle the splitting, processing, and uploading of large files in chunks.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [createFileChunks](#createFileChunks)
  - [generateFileHash](#generateFileHash)
  - [UploadHelper](#UploadHelper)
- [Examples](#examples)
  - [Example: Splitting and Uploading a File](#example-splitting-and-uploading-a-file)
  - [Example: Generating a File Hash in Chunks](#example-generating-a-file-hash-in-chunks)
  - [Example: Uploading](#example-uploading)
  - [Example: Uploading with IndexedDBName and Retrieving IndexedDB Data](#example-uploading-with-indexeddbname-and-retrieving-indexeddb-data)
  - [Example: Pausing, Resuming, and Canceling Uploads](#example-pausing-resuming-and-canceling-uploads)
- [License](#license)

## Installation

To install the FileChunksTools library, use the following command:

```bash
npm install large-file-upload
```

## API Reference

### `createFileChunks`

Splits the given file into multiple chunks of the specified size.

**Parameters**:

- `file: File` - The file to be split.
- `customChunkSize?: number` - Custom size of each chunk (in MB). If not provided, the function automatically determines the chunk size.

**Returns**:

- `Promise<FileChunkResult>` - An object containing the file chunks and chunk size.

### `generateFileHash`

Calculate the hash of the given file.

**Parameters**:

- `file: File`
- `customChunkSize?: number`

**Returns**:

- `Promise<{ hash: string, chunkSize: number }>` - A promise that resolves to an object containing the hash and chunk size.

### `UploadHelper`

A utility class to manage and control the upload of file chunks with support for concurrency, pausing, resuming, and canceling uploads. Additionally, `UploadHelper` integrates with `IndexedDB` for handling task persistence and retrying in case of failures.

**Constructor Parameters**:

- `tasks: T[]` - An array of file chunks to be uploaded.
- `options: UploadHelperOptions` - Optional settings for controlling the upload:
  - `maxConcurrentTasks?: number` - Maximum concurrent uploads (default: number of CPU cores).
  - `indexedDBName?: string` - Optional name of the IndexedDB database to store tasks and upload states for persistent uploads.

**Methods**:

- `exec(func: AsyncFunction<T, R>): Promise<R[]>`: Executes the upload tasks in the queue with the provided async function for processing each chunk.
- `pause()`: Pauses the ongoing uploads and stores their state in `IndexedDB` (if enabled).
- `resume()`: Resumes paused uploads from where they left off, reloading tasks from `IndexedDB` (if enabled).
- `cancelAll()`: Cancels all ongoing and pending uploads and clears the associated `IndexedDB`.
- `setIndexChangeListener(listener: (index: number) => void)`: Sets a listener to monitor the current task index.
- `static getDataByDBName<T>(indexedDBName: string): Promise<T[]>`: Static method to retrieve task data from `IndexedDB` for a given database name.
- `static deleteDataByDBName(indexedDBName: string): Promise<void>`: Static method to delete the `IndexedDB` database by name.

**IndexedDB Integration**:

When you provide an `indexedDBName` as an option, the `UploadHelper` automatically stores the state of each chunk in IndexedDB. This enables you to resume file uploads even after a page reload, system crash, or network failure. Once the uploads are completed successfully, the database is automatically cleared.

## Examples

### Example: Splitting a File

This example demonstrates how to use the `createFileChunks` function to split a file into multiple chunks.

```typescript
import { createFileChunks } from 'large-file-upload';

async function splitAndUploadFile(file: File) {
  const { fileChunks, chunkSize } = await createFileChunks(file);
}
```

### Example: Generating a File Hash in Chunks

This example shows how to generate a hash for a large file using the `generateFileHash` function.

```typescript
import { generateFileHash } from 'large-file-upload';

async function hashLargeFile(file: File) {
  const { hash, chunkSize } = await generateFileHash(file);
  console.log('Generated hash for the large file:', hash);
  console.log('Chunk Size:', chunkSize);
}
```

### Example: Uploading

This example demonstrates how to use `UploadHelper`

```typescript
import { UploadHelper, createFileChunks } from 'large-file-upload';

async function uploadWithoutIndexedDB(file: File) {
  const { fileChunks } = await createFileChunks(file);

  const uploadHelper = new UploadHelper(fileChunks);

  // Execute the upload tasks with an async function passed to exec
  await uploadHelper.exec(async ({ data, signal }) => {
    console.log(`Uploading chunk ${data.index}`);
    
    // Simulate upload
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Chunk ${data.index} uploaded`);
        resolve(true);
      }, 1000);
    });
  });

  console.log('All chunks uploaded without IndexedDB');
}
```

### Example: Uploading with IndexedDBName and Retrieving IndexedDB Data

This example demonstrates how to use the `UploadHelper` with the `indexedDBName` option to store task state in IndexedDB. It also shows how to retrieve and delete IndexedDB data.

```typescript
import { UploadHelper, createFileChunks } from 'large-file-upload';

async function uploadWithIndexedDB(file: File) {
  const { fileChunks } = await createFileChunks(file);

  const uploadHelper = new UploadHelper(fileChunks, {
    indexedDBName: 'myUploadDB',  // IndexedDB is used to store task state
  });

  // Execute the upload tasks with an async function passed to exec
  await uploadHelper.exec(async ({ data, signal }) => {
    console.log(`Uploading chunk ${data.index}`);
    
    // Simulate upload
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Chunk ${data.index} uploaded`);
        resolve(true);
      }, 1000);
    });
  }).then(res => res);

  console.log('All chunks uploaded with IndexedDB support');

  // Retrieve data from IndexedDB
  const indexedDBData = await UploadHelper.getDataByDBName('myUploadDB');
  console.log('IndexedDB data:', indexedDBData);

  // Delete the IndexedDB data
  await UploadHelper.deleteDataByDBName('myUploadDB');
  console.log('IndexedDB cleared');
}
```

### Example: Pausing, Resuming, and Canceling Uploads

```typescript
import { UploadHelper } from 'large-file-upload';

// Pausing the uploads
uploadHelper.pause();

// Resuming the uploads
uploadHelper.resume();

// Canceling all ongoing and pending uploads
uploadHelper.cancelAll();
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.