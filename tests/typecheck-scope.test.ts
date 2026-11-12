import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// `bun run check` type-checks only what these files name. svelte-check reads tsconfig.json's
// include list, which once left out scripts/, e2e/ and vitest.config.ts, so a type error there
// passed check and CI. scripts/ runs under Bun, not in a browser, so tsconfig.scripts.json
// checks it without the DOM lib. Each file is pinned whole: a change to the scope or to an
// option that turns checking off edits this test too, and a comment in the JSON fails here.

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

describe('type-check scope', () => {
  it('bun run check runs svelte-check on tsconfig.json, then tsc on the service worker and scripts/', () => {
    const scripts = readJson('package.json').scripts as Record<string, string>;
    expect(scripts.check).toBe(
      'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json && tsc -p src/service-worker && tsc -p tsconfig.scripts.json'
    );
  });

  it('tsconfig.json includes the app, its tests, e2e/ and the vite, vitest and playwright configs', () => {
    expect(readJson('tsconfig.json')).toEqual({
      extends: '$app/tsconfig',
      compilerOptions: { rewriteRelativeImportExtensions: true, sourceMap: true, strict: true },
      include: ['src', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tests', 'e2e'],
      exclude: ['src/service-worker']
    });
  });

  it("tsconfig.scripts.json checks scripts/ with the app's esnext target and lib, its import rules (verbatimModuleSyntax, isolatedModules), Node types and no DOM lib", () => {
    expect(readJson('tsconfig.scripts.json')).toEqual({
      compilerOptions: {
        module: 'esnext',
        target: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        verbatimModuleSyntax: true,
        isolatedModules: true,
        lib: ['esnext'],
        types: ['node']
      },
      include: ['scripts']
    });
  });
});
