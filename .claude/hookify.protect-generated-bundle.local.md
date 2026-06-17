---
name: protect-generated-bundle
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: static/puzzles\.bundle\.json$
---

🚫 **`static/puzzles.bundle.json` is generated — don't edit it by hand.**

This is the baked fallback puzzle bundle, produced deterministically by
`scripts/pregen.ts` from `ENGINE_VERSION`. Hand-edits create puzzles that won't
match live engine generation and get silently overwritten on the next build.

**To change its contents:** edit the engine generators under `src/engine/puzzles/`,
bump `ENGINE_VERSION` in `scripts/pregen.ts` if generation output changed, then run:

    bun run pregen
