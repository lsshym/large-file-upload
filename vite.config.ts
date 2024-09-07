import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  server: {
    proxy: {
      // 将 /api 的请求代理到 http://localhost:3030
      "/api": {
        target: "http://localhost:3030",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // 可选：如果你想移除路径中的 /api
      },
    },
  },
  build: {
    lib: {
      entry: "./lib/main.ts",
      name: "file-chunks-tools", // 库的全局变量名称（用于 UMD/IIFE 构建）
      fileName: "file-chunks-tools", // 输出文件名，基于不同格式生成文件
    },
  },
  plugins: [
    dts({
      include: ["./lib/**/*"],
      compilerOptions: {
        declaration: true, // 启用声明文件生成
        emitDeclarationOnly: true, // 只生成声明文件，不生成 .js 文件
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
      },
    }),
    visualizer(),
  ],
});
