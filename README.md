# file-upload-tools

file-upload-tools is a powerful and flexible library designed to handle the splitting, processing, and uploading of large files in chunks.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [currentFileChunks](#currentfilechunks)
  - [generateFileHash](#generatefilehash)
  - [UploadFileTool](#uploadfiletool)
- [Examples](#examples)
  - [Example: Splitting and Uploading a File](#example-splitting-and-uploading-a-file)
  - [Example: Generating a File Hash in Chunks](#example-generating-a-file-hash-in-chunks)
  - [Example: Using UploadFileTool to Manage File Uploads](#example-using-uploadfiletool-to-manage-file-uploads)
- [License](#license)

## Installation

To install the FileChunksTools library, use the following command:

```bash
npm install file-upload-tools
```

## API Reference

### `currentFileChunks`

Splits the given file into multiple chunks of the specified size.

**Parameters**:

- `file: File` - The file to be split.
- `customChunkSize?: number` - Custom size of each chunk (in MB). If not provided, the function automatically determines the chunk size.

**Returns**:

- `Promise<FileChunkResult>` - An object containing the file chunks and chunk size.

### `generateFileHash`

Calculate the hash of the given file using MD5.

**Parameters**:

- `file: File`
- `customChunkSize?: number`

**Returns**:

- `Promise<{ hash: string, chunkSize: number }>` - A promise that resolves to an object containing the hash and chunk size.

### `UploadFileTool`

A utility class to manage and control the upload of file chunks with support for concurrency, pausing, resuming, and canceling uploads.

**Parameters**:

- `functions: AsyncFunction<T>[]` - An array of async functions representing upload tasks.
- `maxConcurrentTasks: number` - The maximum number of concurrent upload tasks. Defaults to the number of CPU cores.
- `maxErrors: number` - The maximum allowed errors before aborting. Defaults to 10.

**Methods**:

- `exec(): Promise<T[]>` - Executes the upload tasks in the queue. 
- `pause()`: Pauses the ongoing uploads.
- `resume()`: Resumes the paused uploads.
- `cancelAll()`: Cancels all ongoing and pending uploads.
- `setIndexChangeListener(listener: (index: number) => void)`: Sets a listener to monitor the current task index.

**Note**:
You must use `await` to wait for the request to complete, otherwise the upload result cannot be obtained.

**Returns**:

- A promise that resolves to an array of results for each upload task.

## Examples

### Example: Splitting a File into Chunks

This example demonstrates how to use the `currentFileChunks` function to split a file into multiple chunks:

```typescript
import { currentFileChunks } from 'file-upload-tools';

async function splitFile(file: File) {
  // Split the file into chunks
  const { fileChunks, chunkSize } = await currentFileChunks(file);
  console.log('File has been split into the following chunks:');
  fileChunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1} of size ${chunk.size} bytes`);
  });
  console.log('Chunk Size:', chunkSize);
}
```

### Example: Generating a File Hash in Chunks

This example shows how to generate a hash for a large file using the `generateFileHash` function, which processes the file in chunks:

```typescript
import { generateFileHash } from 'file-upload-tools';

async function hashLargeFile(file: File) {
  const { hash, chunkSize } = await generateFileHash(file);

  console.log('Generated hash for the large file:', hash);
  console.log('Chunk Size:', chunkSize);
}
```

### Example: Using UploadFileTool to Manage File Uploads

This example demonstrates how to use the `UploadFileTool` to manage and control the upload of file chunks:

```typescript
import { UploadFileTool } from 'file-upload-tools';

async function uploadLargeFileChunks(chunks: AsyncFunction[]) {
  const { fileChunks, chunkSize } = currentFileChunks(file);
  const fileChunksArr = fileChunks.map((chunk, index) => {
    // signal parameter is optional
    return async ({ signal }) => {
      const fd = new FormData();
      fd.append('chunkFile', chunk);
      // Must use await to wait for the request to complete, otherwise the upload result cannot be obtained
      const value = await axios({
        url: `api/upload`,
        method: 'post',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        data: fd,
        signal,
      });
      return value;
    };
  });
  const uploadTool = new UploadFileTool(fileChunksArr); // 3 concurrent uploads

  // Set a listener to monitor the progress
  uploadTool.setIndexChangeListener(index => {
    console.log(`Currently processing chunk index: ${index}`);
  });

  // Execute the upload tasks
  try {
    const results = await uploadTool.exec().then(res => res);
    console.log('All chunks have been uploaded successfully:', results);
  } catch (error) {
    console.error('Error during file upload:', error);
  }
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
