import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  // Preserve MapLibre's worker URL relative to its distributed module.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // Browser profiles contain locked files on Windows; test artifacts are not source files.
  server: { watch: { ignored: ['**/validation-results/**', '**/test-results/**', '**/playwright-report/**'] } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], clearMocks: true },
});
