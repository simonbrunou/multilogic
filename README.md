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
`$PORT`). Two deployment paths are provided:

### Docker

```bash
docker build -t multilogic .
docker run -p 3000:3000 multilogic
```

Multi-stage build (`Dockerfile`): installs deps + pre-generates the bundle + builds the
static SPA, then serves `build/` from a slim Bun runtime image.

### Railway (Railpack)

`railway.json` selects the Railpack builder and `railpack.json` defines the build/deploy
steps (install → `pregen` → `build`, start `bun serve.js`). Railway injects `$PORT`, which
`serve.js` honors. To deploy the Dockerfile instead, set `build.builder` to `"DOCKERFILE"`
in `railway.json`.
