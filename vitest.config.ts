import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["packages/libs/**/src/**/*.test.ts", "packages/apps/**/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/libs/**/src/**/api/**", "packages/libs/**/src/**/model/**"],
    },
  },
})
