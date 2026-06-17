---
name: block-engine-impurity
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/engine/.*\.ts$
  - field: new_text
    operator: regex_match
    pattern: \b(window|self|document|performance|crypto|localStorage)\b|\bMath\.random\b
---

🚫 **Engine purity violation — `src/engine/` must stay runtime-agnostic.**

You're writing a forbidden global/API into the pure puzzle engine. This is the
project's #1 invariant (enforced reactively by `no-restricted-globals` in
`eslint.config.js` and by `tsconfig.engine.json` having no DOM lib). This hook
catches it at write time instead of at CI.

**Forbidden in `src/engine/**`:** `window`, `self`, `document`, `performance`,
`crypto`, `localStorage`, `Math.random`.

**Do instead:**
- Randomness → the injected `PRNG` (`args.prng.next()/int()/shuffle()/pick()`),
  never `Math.random`. Seeded determinism is what makes puzzles reproducible.
- Time/abort → the engine receives an `AbortLike` (`args.signal`), not DOM APIs.
- Anything runtime-specific belongs in `src/worker/`, `src/lib/`, or the route —
  the engine takes it as a parameter.

The engine has zero runtime deps and must compile under `tsconfig.engine.json`.
