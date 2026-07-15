import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: { include: ['tests/**/*.spec.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
  resolve: {
    alias: {
      '@payload-config': resolve(dir, 'src/payload.config.ts'),
      '@': resolve(dir, 'src'),
      'server-only': resolve(dir, 'src/stubs/server-only.ts'),
    },
  },
})
