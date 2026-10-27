import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['benchmarks/**/*.bench.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 180_000,
    maxWorkers: 1,
    fileParallelism: false,
  },
})
