import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/__tests__/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
