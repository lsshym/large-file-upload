# file-upload-tools

file-upload-tools is a powerful and flexible library designed to handle the splitting, processing, and uploading of large files in chunks.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [currentFileChunks](#currentfilechunks)
  - [generateFileHash](#generatefilehash)
- [Examples](#examples)
  - [Example: Splitting and Uploading a File](#example-splitting-and-uploading-a-file)
  - [Example: Generating a File Hash in Chunks](#example-generating-a-file-hash-in-chunks)
  - [Example: Managing Concurrent Uploads with PromisePool](#example-managing-concurrent-uploads-with-promisepool)
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

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
