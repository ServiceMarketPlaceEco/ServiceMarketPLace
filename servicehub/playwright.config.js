// playwright config for the servicehub frontend
// it starts the vite dev server by itself so you just run: npm run test:e2e

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  timeout: 30 * 1000,
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
  
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60 * 1000
  },
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  expect: {
    timeout: 10 * 1000
  }
})
