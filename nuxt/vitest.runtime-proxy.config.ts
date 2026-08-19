import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["test/integration/reader-runtime-proxy.spec.ts"],
    maxWorkers: 1,
    testTimeout: 30_000
  }
})
