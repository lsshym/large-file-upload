import { createHash } from 'node:crypto';
import { generateFileMd5 } from '../../../lib/apis/generateIdUtils/generateFileMd5';

function md5Hex(content: string | Uint8Array): string {
  return createHash('md5').update(content).digest('hex');
}

describe('generateFileMd5', () => {
  it('generates the full MD5 hash for a text file', async () => {
    const content = 'hello large-file-upload';
    const file = new File([content], 'hello.txt');

    await expect(generateFileMd5(file)).resolves.toBe(md5Hex(content));
  });

  it('hashes every chunk yielded by a custom file stream', async () => {
    const chunks = [
      new Uint8Array([1, 2]),
      new Uint8Array([3]),
      new Uint8Array([4, 5, 6]),
    ];
    const file = {
      stream: () => {
        let index = 0;
        return {
          getReader: () => ({
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined };
              }

              return { done: false, value: chunks[index++] };
            },
          }),
        };
      },
    } as unknown as File;
    const expected = md5Hex(Uint8Array.from([1, 2, 3, 4, 5, 6]));

    await expect(generateFileMd5(file)).resolves.toBe(expected);
  });

  it('rejects when the file stream reader fails', async () => {
    const file = {
      stream: () => ({
        getReader: () => ({
          read: async () => {
            throw new Error('read failed');
          },
        }),
      }),
    } as unknown as File;

    await expect(generateFileMd5(file)).rejects.toThrow('read failed');
  });
});
