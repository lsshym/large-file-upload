import { createFileChunks } from '../../lib/apis/createFileChunks';

const MB = 1024 * 1024;

function createFile(size: number, name = 'test.bin'): File {
  return {
    name,
    size,
    slice: (start = 0, end = size) =>
      ({
        size: Math.max(0, Math.min(end, size) - start),
      }) as Blob,
  } as File;
}

describe('createFileChunks', () => {
  it('throws when the file is missing', () => {
    expect(() => createFileChunks(undefined as unknown as File)).toThrow(
      'File not found or size is 0',
    );
  });

  it('throws when the file size is zero', () => {
    expect(() => createFileChunks(new File([], 'empty.bin'))).toThrow(
      'File not found or size is 0',
    );
  });

  it('uses 1 MB chunks for files smaller than 100 MB', () => {
    const result = createFileChunks(createFile(3 * MB + 512));

    expect(result.chunkSize).toBe(1);
    expect(result.fileChunks).toHaveLength(4);
    expect(result.fileChunks.map(chunk => chunk.size)).toEqual([MB, MB, MB, 512]);
  });

  it('uses 5 MB chunks for files from 100 MB up to less than 1 GB', () => {
    const result = createFileChunks(createFile(100 * MB));

    expect(result.chunkSize).toBe(5);
    expect(result.fileChunks).toHaveLength(20);
    expect(result.fileChunks.every(chunk => chunk.size === 5 * MB)).toBe(true);
  });

  it('uses 10 MB chunks for files of 1 GB or larger', () => {
    const result = createFileChunks(createFile(1024 * MB));

    expect(result.chunkSize).toBe(10);
    expect(result.fileChunks).toHaveLength(103);
    expect(result.fileChunks.at(-1)?.size).toBe(4 * MB);
  });

  it('uses floored custom chunk sizes in MB', () => {
    const result = createFileChunks(createFile(7 * MB), 2.9);

    expect(result.chunkSize).toBe(2);
    expect(result.fileChunks.map(chunk => chunk.size)).toEqual([2 * MB, 2 * MB, 2 * MB, MB]);
  });

  it('falls back to 4 MB when custom chunk size is invalid', () => {
    const result = createFileChunks(createFile(9 * MB), 0);

    expect(result.chunkSize).toBe(4);
    expect(result.fileChunks.map(chunk => chunk.size)).toEqual([4 * MB, 4 * MB, MB]);
  });

  it('falls back to 4 MB when custom chunk size is not finite', () => {
    const result = createFileChunks(createFile(9 * MB), Number.POSITIVE_INFINITY);

    expect(result.chunkSize).toBe(4);
    expect(result.fileChunks.map(chunk => chunk.size)).toEqual([4 * MB, 4 * MB, MB]);
  });

  it('falls back to 4 MB when custom chunk size is NaN', () => {
    const result = createFileChunks(createFile(9 * MB), Number.NaN);

    expect(result.chunkSize).toBe(4);
    expect(result.fileChunks.map(chunk => chunk.size)).toEqual([4 * MB, 4 * MB, MB]);
  });
});
