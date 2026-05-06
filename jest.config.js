/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^yocto-queue$': '<rootDir>/__mocks__/yoctoQueueMock.cjs',
    '\\.worker\\.ts\\?worker$': '<rootDir>/__mocks__/workerMock.ts',
  },
};
