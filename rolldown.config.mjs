import { defineConfig } from "rolldown";

export default defineConfig({
  platform: "node",
  input: "src/index.ts",
  external: [/^[^./]/, import.meta.resolve("./package.json")],
  treeshake: {
    // https://github.com/rolldown/rolldown/issues/8299
    moduleSideEffects: "no-external",
  },
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
