import { defineConfig } from "rolldown";

export default defineConfig({
  platform: "node",
  input: "src/index.ts",
  external: [/^[^./]/, import.meta.resolve("./package.json")],
  output: [
    {
      sourcemap: false,
      minify: "dce-only",
      format: "cjs",
      file: "dist/index.js",
    },
    {
      sourcemap: false,
      minify: "dce-only",
      format: "esm",
      file: "dist/index.mjs",
    },
  ],
});
