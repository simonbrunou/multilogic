import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

// Two projects:
//  - `unit`    : fast Node tests for the pure engine + lib logic (the bulk of the suite).
//  - `browser` : real-browser component tests (Svelte 5 mount) via Playwright/Chromium.
// Coverage is gathered from the `unit` project only (the logic it owns); the UI layer is
// exercised by the browser project and Playwright e2e instead.
export default defineConfig({
  plugins: [svelte()],
  // Mirror SvelteKit's `$lib` alias so components that import `$lib/...` (e.g. i18n) can be
  // mounted in isolation by the browser project. The bare `svelte()` plugin doesn't add it.
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/components/**'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/components/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/engine/**', 'src/lib/**'],
      // UI/markup + browser-only glue (Worker, fetch, .svelte imports) are covered by the
      // browser + e2e suites, not the Node unit run, so they're out of the unit gate.
      exclude: [
        'src/**/*.svelte',
        'src/**/*.svelte.ts',
        'src/lib/i18n/**',
        'src/lib/load-instance.ts',
        'src/lib/worker-transport.ts',
        'src/lib/play/registry.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 85
      }
    }
  }
});
