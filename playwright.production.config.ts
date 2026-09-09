import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'amedas-production.spec.ts', workers: 1,
  outputDir: 'validation-results/amedas-production',
  use: {
    baseURL: 'http://127.0.0.1:5175', viewport: { width: 1280, height: 900 },
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {}),
      args: ['--enable-webgl', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175', reuseExistingServer: false,
  },
});
