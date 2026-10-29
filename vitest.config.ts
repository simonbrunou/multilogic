import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

// Two projects:
//  - `unit`    : fast Node tests for the pure engine + lib logic (the bulk of the suite).
//  - `browser` : real-browser component tests (Svelte 5 mount) via Playwright/Chromium.
// Coverage is gathered from the `unit` project only (the logic it owns); the UI layer is
// exercised by the browser project and Playwright e2e instead.
export default defineConfig({
  // The component project needs no preprocessors (Svelte 5 compiles TypeScript natively), and
  // SvelteKit 3 reads its options from vite.config.ts rather than a svelte.config.js file.
  plugins: [svelte({ configFile: false })],
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/components/**'],
          environment: 'node',
          // CPU-bound puzzle generation under v8 coverage ran 5-7x slower on the shared
          // self-hosted CI runner when it was busy (timings in #83). The default is a hang
          // guard, not a performance budget; tests that pass their own timeout keep it.
          testTimeout: 60_000
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
