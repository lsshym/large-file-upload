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
    '\\.worker\\.ts\\?worker$': '<rootDir>/__mocks__/workerMock.ts',
  },
};
