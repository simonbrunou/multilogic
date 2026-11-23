# multilogic

Procedurally generated logic puzzles, played in the browser. A static SvelteKit SPA
with a pure-TypeScript puzzle engine (generation, uniqueness solving, difficulty rating,
hints) that runs in a Web Worker. v1 ships Sudoku.

## Develop

```bash
bun install
bun run dev           # dev server
bun run test          # all Vitest tests (unit + browser — browser needs Chromium)
bun run test:unit     # Node unit tests only (engine + lib logic)
bun run test:coverage # unit tests with coverage thresholds
bun run test:browser  # component tests in real Chromium (vitest-browser-svelte)
bun run test:e2e      # Playwright end-to-end flows
bun run check         # svelte-check (type-check)
bun run lint          # eslint
```

> First run of the browser/e2e tests needs `bunx playwright install chromium`.

## Build (static SPA)

```bash
bun run pregen       # writes static/puzzles.bundle.json (worker fallback bundle)
bun run build        # static output in build/
bun run serve        # serve build/ on $PORT (default 3000)
```

## Deploy

The app builds to a static site served by a tiny portable server (`serve.js`, listens on
`$PORT`, default 3000). Production runs on Coolify, whose `build_pack` setting picks one of
two builds with the same steps (install → `pregen` → `build`, start `bun serve.js`):

- `dockerfile`: `Dockerfile` builds on Node with the pinned Bun, then ships `oven/bun`'s slim
  image with `build/` and `serve.js` added.
- `railpack`: `railpack.json` defines the steps, and `railway.json` selects the same Railpack
  builder on Railway. Railpack installs the Bun release that `packageManager` in
  `package.json` names, and the Node major in `.nvmrc`.

Both read `.dockerignore` as the list of paths they leave out of the build.
