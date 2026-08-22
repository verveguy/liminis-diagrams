import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // happy-dom for the whole suite: `src/core` needs no DOM, but running it
    // under one environment keeps a single config. The React-free guarantee for
    // `./core` is enforced by its import graph and by the build, not by the
    // test environment.
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.config.*'],
    },
  },
})
