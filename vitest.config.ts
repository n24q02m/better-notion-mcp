import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The worker handler test (tests/worker.test.ts) runs in plain node.
  // `@cloudflare/containers` (the NotionContainer base) imports the
  // `cloudflare:workers` virtual module, which only exists in the workerd
  // runtime, so alias it to a local stub for unit tests.
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./tests/cloudflare-workers-stub.ts', import.meta.url))
    }
  },
  test: {
    exclude: ['build/**', 'node_modules/**', 'bin/**', 'tests/live/**', 'tests/e2e*'],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'build/', 'bin/']
    }
  }
})
