/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
        },
        isolatedModules: true,
      },
    ],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^yocto-queue$': '<rootDir>/__mocks__/yoctoQueueMock.cjs',
    '\\.ts\\?worker$': '<rootDir>/__mocks__/workerMock.cjs',
  },
};
