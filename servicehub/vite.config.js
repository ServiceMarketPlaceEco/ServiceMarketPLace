import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // playwright e2e tests live in tests/ and run separately with npm run test:e2e
    exclude: ['node_modules/**', 'tests/**']
  }
})