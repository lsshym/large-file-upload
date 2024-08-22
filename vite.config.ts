import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import typescript2 from "rollup-plugin-typescript2";

export default defineConfig({
  build: {
    lib: {
      entry: "./lib/main.ts",
      name: "Counter",
      fileName: "counter",
    },
  },
  // plugins: [typescript2()],
});
