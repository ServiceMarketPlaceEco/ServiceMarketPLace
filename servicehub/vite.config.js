import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  test: {
    // Allow describe(), it() and expect() without importing them.
    globals: true,

    // Vue Test Utils requires a browser-like document and window.
    environment: 'jsdom',

    // Only run Vitest unit/component tests.
    include: ['src/**/*.{test,spec}.{js,ts}'],

    // Playwright end-to-end tests run separately.
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/**'
    ],

    // Uncomment only if this file genuinely exists.
    // setupFiles: ['./src/test/setup.js']
  }
})