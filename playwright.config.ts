import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'bun run pregen && bun run build && bunx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  // Pin the browser locale so the app's auto-detection resolves to French, keeping these
  // French-text assertions stable regardless of the host machine's locale.
  use: { baseURL: 'http://localhost:4173', locale: 'fr-FR' }
});
