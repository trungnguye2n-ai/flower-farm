// End-to-end smoke of the admin against a production build, on the TEST
// database (global setup wipes it, and refuses any name not ending in _test).
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

if (existsSync('.env')) process.loadEnvFile('.env')
const PORT = 3100

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Tests share one database: run them one after another
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { ...(process.env as Record<string, string>), DATABASE_URL: process.env.DATABASE_URL_TEST ?? '', APP_URL: `http://localhost:${PORT}` },
  },
})
