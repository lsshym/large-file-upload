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
  testMatch: ['**/*.test.ts'], // 只处理以 .test.ts 结尾的文件
};
