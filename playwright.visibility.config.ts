import { defineConfig } from '@playwright/test';

// Serve the existing build independently of the live soak test's Vite server.
export default defineConfig({
  testDir: './e2e', testMatch: 'visibility.spec.ts', workers: 1, timeout: 60_000,
  outputDir: 'validation-results/visibility',
  use: { baseURL: 'http://127.0.0.1:5174' },
  webServer: {
    command: 'npm run preview -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174', reuseExistingServer: false,
  },
});
