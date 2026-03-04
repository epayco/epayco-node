import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  target: "node18",
  clean: true,
  splitting: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = { "@": path.resolve(__dirname, "src") };
  },
});
