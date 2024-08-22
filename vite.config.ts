import { defineConfig } from "vite";
import typescript2 from "rollup-plugin-typescript2";

export default defineConfig({
  build: {
    lib: {
      entry: "./lib/main.ts",
      name: "FileChunkTools", // 库的全局变量名称（用于 UMD/IIFE 构建）
      fileName: 'file-chunk-tools', // 输出文件名，基于不同格式生成文件
    },
  },
  plugins: [
    typescript2({
      tsconfig: "lib/tsconfig.json",
    }),
  ],
});
