# Tooling & Hardening Audit — multilogic

**Date:** 2026-06-14 · **Mode:** report-only (no code changed, no migrations, no DB touched)
**Scope:** static SvelteKit SPA, pure-TS puzzle engine, served by a custom static server.

Every finding below is grounded in real tool output or a cited file/line. Where I inferred,
it says so. Phases that don't apply to this project are marked **N/A** with a reason.

---

## TL;DR — critical findings first

There are **no critical security or data-isolation findings.** This is a single-user,
client-only static SPA: no database, no auth, no sessions, no server routes, no `$env`
usage, and **zero runtime npm dependencies** (`dependencies: {}`). The classic SvelteKit
foot-guns (secret leaks, unscoped multi-tenant queries, server/client boundary breaks)
**do not exist here by construction.**

The real gaps are in **CI coverage** and **runtime hardening**, not the code:

1. **CI gates only `fallow`.** Type-checking, linting, unit tests, build, and e2e are
   *not* run on PRs — a PR that breaks `svelte-check` or `vitest` can merge green. *(high)*
2. **`serve.js` sends no security response headers** — no CSP, `X-Content-Type-Options`,
   `X-Frame-Options`/`frame-ancestors`, or `Referrer-Policy`. *(medium)*
3. **No component tests and a single e2e smoke file.** Engine logic is very well covered
   (163 unit tests); the Svelte UI layer is essentially untested. *(medium)*

---

## Phase 0 — Current-state inventory

| Category | Present? | Version / detail | Gap |
|---|---|---|---|
| Project shape | ✅ | **SvelteKit app**, SPA (`adapter-static`, `fallback: 'index.html'`) | — |
| Svelte | ✅ | **5.56** (runes) | — |
| SvelteKit | ✅ | **2.63** | — |
| Build tooling | ✅ | **Vite 8**, `@sveltejs/vite-plugin-svelte` 7 | — |
| Package manager | ✅ | **bun** (`bun.lock`, `engine-strict=true`) | `engines` field missing (below) |
| TypeScript | ✅ | **6.0**, `strict: true`, `checkJs: true`; separate `tsconfig.engine.json` | — |
| Lint | ✅ | ESLint 10 + typescript-eslint 8; engine has `no-restricted-globals` purity rules | not run in CI |
| Format (prettier) | ❌ | none | optional; no `.prettierrc` |
| Unit tests | ✅ | **Vitest 4** (node env), 163 tests / 37 files, 2 fast-check property suites | no coverage gate; UI untested |
| E2E | ✅ | **Playwright 1.60**, 1 file `e2e/smoke.spec.ts` (8 tests) | thin coverage |
| Coverage | ⚠️ | `@vitest/coverage-v8` installed | no script, no thresholds |
| Data layer / ORM / DB | ❌ | none — persistence is `localStorage` (`src/lib/storage.ts`, schema-versioned) | **N/A** |
| Auth / sessions | ❌ | none | **N/A** |
| Server code | ❌ | no `+*.server.*`, no `+server.*`, no `$lib/server`, no `$env` | **N/A** |
| Adapter | ✅ | `@sveltejs/adapter-static` (SPA fallback) — matches deploy | — |
| Deploy | ✅ | Railway (Railpack) / Docker → custom `serve.js` static server on `$PORT` | headers (below) |
| Code-health tooling | ✅ | **fallow 2.96** wired into CI (`.fallowrc.json`, `.github/workflows/fallow.yml`, MCP) | only gate in CI |
| Error monitoring | ❌ | none | optional (below) |
| Runtime deps | ✅✅ | **`dependencies: {}` — zero** | excellent supply-chain posture |

**Entry points:** `serve.js` (runtime server), `src/routes/**` (SvelteKit pages), worker at
`src/worker/generate.worker.ts`. Engine lives in `src/engine/**` (runtime-agnostic, pure TS).
Data access is `src/lib/storage.ts` over `localStorage`.

---

## Phase 1 — Static analysis (real tool output)

### fallow (already installed & CI-gated) — the project's primary tool

```
fallow dead-code  → ✓ No issues found (62 entry points)
fallow dupes      → ✓ No duplication ≥ minOccurrences=3 (12 small clone groups hidden)
fallow health     → ✗ 0 above threshold · 684 analyzed · maintainability 89.1 (good)
```

No dead code, no over-threshold complexity, no cycles. The `health` "high-impact file"
list is advisory coupling guidance on 16–80 LOC files, **not** issues — safe to ignore.

### knip (one-off, no config) — **noise, do not adopt as-is**

```
Unused exported types (8): AbortLike, PuzzleBase, BakedPuzzle,
  GenerateRequest, CancelRequest, ResultResponse, ErrorResponse, ProgressResponse
```

**All 8 are false positives** — verified by hand:
- `GenerateRequest|CancelRequest` → `WorkerRequest`; the three `*Response` → `WorkerResponse`
  (`src/worker/protocol.ts:14,33`).
- `PuzzleBase` is extended by `DeductionPuzzle`/`ConstructionPuzzle` (`types.ts:54,61`).
- `AbortLike` is the type of `GenArgs.signal` (`types.ts:22`); `BakedPuzzle` is used as
  `BakedPuzzle[]` (`puzzle-service.ts:19`).

Knip's default config doesn't trace intra-module type references. **Verdict: skip knip** —
fallow (configured, CI-gated, found 0) already covers unused exports/files/deps without the
noise. Adopting knip would mean maintaining a second config to suppress false positives.

### jscpd — low duplication, one minor cluster

```
Total: 110 files · 6746 lines · 16 clones · 140 dup lines (2.08%)
```

Below any actionable threshold. The one cluster worth a glance is the puzzle-load
boilerplate (`try { svc.request(...) → deserializeInstance → store.load } catch … finally`)
repeated across the four route files (`routes/{play,daily}/{[type],grecolatin}/+page.svelte`).
**Verdict:** optional small shared `loadInstance()` helper; not worth wiring jscpd into CI
(fallow `dupes` already covers it).

### dependency-cruiser — boundary verified (tool was finicky under bunx)

The classic SvelteKit rule (forbid client code importing `$lib/server`) is **N/A** — there
is no server-only code. The meaningful boundary here is **engine purity**: `src/engine/**`
must stay runtime-agnostic. Verified two ways:

- ESLint already enforces it via `no-restricted-globals` (`self`/`window`/`document`/
  `crypto`/`Math.random`) on `src/engine/**` (`eslint.config.js`).
- Grep confirms **zero** imports from engine into `lib`/`routes`/`worker` and **zero**
  `$lib`/`$app`/`$env` aliases in engine.

> ⚠️ **Supply-chain note:** `bunx depcruise` resolved a **dependency-confusion placeholder
> package** (aikido.dev intel decoy), not the tool. The real binary is in `dependency-cruiser`
> (`bunx -p dependency-cruiser depcruise`). A reminder to pin tool invocations to the full
> package name and never blind-`bunx` a short binary alias.

---

## Phase 2 — SvelteKit boundary & env safety

**Largely N/A.** No `$env/static/private` or `$env/dynamic/private` anywhere (grep: 0 hits),
no private env access in components, no `load` returning secrets/DB rows (there are no
server `load`s — universal `+layout.ts` only). All persistence is client `localStorage`.
The one architectural boundary that exists (engine purity) is **clean** — see Phase 1.

---

## Phase 3 — Security & data handling

| Check | Result |
|---|---|
| Multi-user / multi-tenant scoping | **N/A** — single-user, client-only, no shared backend |
| Auth / sessions / Better Auth | **N/A** — no auth exists; nothing to migrate |
| Input validation at trust boundaries | ✅ `decodeShare` is regex-validated (`share.ts:29`); `localStorage` reads go through `safeParse` + `SCHEMA_VERSION` guard (`storage.ts:37–59`) |
| XSS sinks | ✅ no `{@html}`, `innerHTML`, `eval`, or `document.cookie` in `src/` |
| Secrets hygiene | ✅ no hardcoded keys/tokens; no `.env*` tracked; `.gitignore` covers `.env`, `.env.*` (allows `.env.example`) |

No findings. (One latent item belongs in Phase 6: the static server emits no CSP, so the
browser has no defense-in-depth if an XSS sink is ever introduced later.)

---

## Phase 4 — Testing gaps

**Existing coverage (strong on the engine):** 163 unit tests across 37 files — every puzzle
module (sudoku, tectonic, kakuro, grecolatin) has generator/solver/rater/rules/hint tests,
plus core `dlx`/`prng`/`effort`/`difficulty` and `lib/` (`storage`, `daily`, `share`,
`game-core`, `puzzle-service`). 2 fast-check property suites. 1 Playwright smoke file
(8 tests). `svelte-check` is clean (437 files, 0 errors, 0 warnings).

**Highest-value missing tests (prioritized — write these, in order):**

1. **Component tests for the four grid components** (`SudokuGrid`, `TectonicGrid`,
   `KakuroGrid`, `GrecoBoard`) — cell selection, note toggling, conflict highlighting,
   keyboard input. *Currently zero UI tests.* → **Vitest 4 browser mode +
   `vitest-browser-svelte`** (needs a `browser`-mode project in `vitest.config.ts`; current
   config is `environment: 'node'`, `include: tests/**` only).
2. **`game.svelte.ts` / `play/*-game.ts` state-machine tests** — undo/redo, win detection,
   timer, persistence round-trip through `createStorage`.
3. **Storage corruption / migration** — feed malformed JSON and a wrong `version` to
   `loadGame`/`getSettings`; assert graceful defaults (logic exists; lock it with a test).
4. **More Playwright flows** — complete a puzzle end-to-end; daily-seed share link
   (`encodeShare`/`decodeShare`) round-trip; locale switch (FR↔EN) persistence.
5. **Coverage gate** — add a `test:coverage` script + thresholds (`@vitest/coverage-v8` is
   already installed but unused).

No auth/multi-tenant/payments boundaries exist, so no negative/abuse tests are required.

---

## Phase 5 — Data layer & migrations

**N/A — no database.** Persistence is `localStorage`, and it already does the right thing:
a `SCHEMA_VERSION` constant with version-mismatch invalidation (`storage.ts:7,58`) and
guarded parsing. No migration tooling, drift check, or backup is applicable. (If a server
DB is ever added, revisit drift checks + backups then.)

---

## Phase 6 — Build, performance & deployment

- **Adapter ↔ target match:** ✅ `adapter-static` with `fallback: 'index.html'` is the
  correct choice; `serve.js` mirrors it with an `index.html` SPA fallback. **Not**
  `adapter-auto`. No mismatch.
- **Bundle size:** ✅ Excellent. `build/` is **320K** total, ~240K JS; largest chunk 48K,
  worker 24K. Zero runtime deps means nothing heavy to flag. A `vite-bundle-visualizer`
  pass is *nice-to-have*, not needed at this size.
- **Caching:** ✅ `serve.js` sets `immutable, max-age=31536000` for `/_app/` hashed assets
  and `no-cache` for HTML — correct.
- **Quick wins:**
  - `serve.js` does **no precompression** — it serves raw bytes. `adapter-static` supports
    `precompress: true` (emits `.br`/`.gz`), but `serve.js` would also need to negotiate
    `Accept-Encoding`. Low priority at 320K.
  - **`.npmrc` has `engine-strict=true` but `package.json` has no `engines` field** — so the
    strict check is a **no-op**. Add `"engines": { "bun": ">=1.x" }` (and/or node) to make it
    real and pin runtime expectations. *(S)*

---

## Phase 7 — Observability & CI

- **Error monitoring:** none. For a privacy-friendly static SPA, a lightweight client hook
  (a top-level `<svelte:boundary>` plus `window.onerror`/`onunhandledrejection`) is the
  pragmatic baseline. If remote reporting is wanted, **self-hosted GlitchTip** (Sentry-SDK
  compatible) fits the self-hosted/privacy posture; wire `@sentry/sveltekit`'s
  `handleErrorWithSentry` in a client `hooks.client.ts`. Low priority for a hobby puzzle game
  — listed for completeness.
- **CI gap (the big one):** the only workflow is `fallow.yml`. It does **not** run
  `svelte-check`, `eslint`, `vitest`, `build`, or `playwright`. A PR that breaks types or
  tests merges green. Proposed complementary workflow (GitHub Actions + bun) — **proposal
  only, not written to disk:**

```yaml
# .github/workflows/ci.yml  (PROPOSAL — complements the existing fallow.yml gate)
name: ci
on:
  pull_request:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run check        # svelte-kit sync && svelte-check (0 errors today)
      - run: bun run lint         # eslint
      - run: bun run test         # vitest (163 tests)
      - run: bun run pregen && bun run build   # ensure static build succeeds
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e     # playwright (webServer builds+previews per config)
```

---

## Prioritized checklist

> Severity: critical / high / medium / low · Effort: S / M / L

| # | Sev | Eff | Item | Action |
|---|-----|-----|------|--------|
| 1 | **high** | S | CI runs only fallow — types/lint/tests/build/e2e ungated | Add the `ci.yml` workflow above (keep `fallow.yml`) |
| 2 | medium | S | `serve.js` sends no security headers | Add `Content-Security-Policy` (script/style/worker self), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin` to the `res.writeHead` block in `serve.js` |
| 3 | medium | M | UI layer has zero tests | Add Vitest browser-mode project + `vitest-browser-svelte`; test the 4 grid components (Phase 4 #1–2) |
| 4 | medium | M | Single e2e smoke test | Add Playwright flows: complete-a-puzzle, share-link round-trip, locale persistence |
| 5 | low | S | `engine-strict=true` is a no-op (no `engines`) | Add `"engines": { "bun": ">=1.0.0" }` to `package.json` |
| 6 | low | S | Coverage installed but unused | Add `"test:coverage": "vitest run --coverage"` + thresholds in `vitest.config.ts` |
| 7 | low | S | No client error capture | Add `hooks.client.ts` + top-level `<svelte:boundary>`; optionally GlitchTip later |
| 8 | low | S | Repeated puzzle-load boilerplate across 4 routes | Extract a shared `loadInstance(svc, type, …)` helper (jscpd cluster) |
| 9 | low | — | Don't adopt knip/jscpd/dependency-cruiser as CI steps | fallow already covers dead-code/dupes/cycles/boundaries; knip default config produced 8 false positives here |
| 10 | info | — | `bunx depcruise` hit a dependency-confusion placeholder | Always invoke tools via full package name (`bunx -p dependency-cruiser depcruise`) |

---

## If I only had time for 3

1. **Add the `ci.yml` gate (#1).** Today a type error or failing test merges green; fallow
   doesn't catch those. Highest risk-reduction for the least effort — and `bun run check`
   already passes, so the gate goes green on day one.
2. **Add security headers to `serve.js` (#2).** A few lines give CSP + clickjacking +
   MIME-sniff protection to every response — cheap defense-in-depth for a public site.
3. **Stand up component/browser tests (#3).** The engine is thoroughly tested; the entire
   Svelte UI is not. Vitest browser mode + `vitest-browser-svelte` closes the biggest real
   coverage gap.

---

*No code, configs, or data were modified during this audit. Awaiting go-ahead before
implementing anything.*
