// fallow-ignore-file unused-file
// Measures Sudoku generation wall-clock under the technique-based rater (rate() runs on
// every candidate removal during digging). Perf gate: if mean expert-generation time is
// within the live worker budget, keep the full ladder in the dig loop; otherwise plan P4
// switches per-removal checks to the cheap effort proxy. The per-band hitRate also reveals
// how often a target band is actually reached (the seed-level floor is a P4 deliverable).
// Run: `bun run scripts/bench-difficulty.ts`.
import { generateForDifficulty } from '../src/engine/puzzles/sudoku/generator';
import { sudoku } from '../src/engine/puzzles/sudoku';
import { createPrng, deriveSeed } from '../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../src/engine/core/types';

const RUNS = 20;
const BUDGET_MS = 2000; // per-generation ceiling for "full ladder during dig is fine"

function timeBand(target: Difficulty): { mean: number; max: number; hitRate: number } {
  let total = 0;
  let max = 0;
  let hits = 0;
  for (let i = 0; i < RUNS; i++) {
    const prng = createPrng(deriveSeed('sudoku', target, 'bench', i));
    const start = performance.now();
    const g = generateForDifficulty(prng, target);
    const dt = performance.now() - start;
    total += dt;
    max = Math.max(max, dt);
    if (g.difficulty === target) hits++;
  }
  return { mean: total / RUNS, max, hitRate: hits / RUNS };
}

let worst = 0;
for (const target of DIFFICULTIES) {
  const { mean, max, hitRate } = timeBand(target);
  worst = Math.max(worst, mean);
  console.log(
    `${target.padEnd(7)} mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms hitRate=${(hitRate * 100).toFixed(0)}%`
  );
}

const verdict = worst <= BUDGET_MS ? 'PASS — keep full ladder in dig loop' : 'FAIL — adopt effort-proxy split in P4';
console.log(`\nGATE: worst mean ${worst.toFixed(1)}ms vs budget ${BUDGET_MS}ms -> ${verdict}`);

console.log('\nModule generate() end-to-end (60-attempt loop, exact-or-throw):');
await (async () => {
  for (const target of DIFFICULTIES) {
    let ok = 0;
    let threw = 0;
    const t0 = performance.now();
    for (let i = 0; i < RUNS; i++) {
      const prng = createPrng(deriveSeed('sudoku', target, 'bench-module', i));
      try {
        const res = await sudoku.generate({ difficulty: target, prng, signal: new AbortController().signal });
        if (res.achievedDifficulty === target) ok++;
      } catch {
        threw++;
      }
    }
    const ms = ((performance.now() - t0) / RUNS).toFixed(0);
    console.log(`${target.padEnd(7)} exact=${((ok / RUNS) * 100).toFixed(0)}% threw=${((threw / RUNS) * 100).toFixed(0)}%  ${ms}ms/req`);
  }
})();
