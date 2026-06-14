<script lang="ts">
  import type { SudokuGame } from '../game-core';
  let { game, selected, tick = 0, conflicts = new Set<number>(), highlightErrors = true, onselect }:
    { game: SudokuGame; selected: number | null; tick?: number; conflicts?: Set<number>; highlightErrors?: boolean; onselect: (i: number) => void } = $props();
</script>

<div class="grid" role="grid">
  {#each game.cells as v, i (i)}
    <button
      class="cell"
      class:given={game.isGiven(i)}
      class:selected={selected === i}
      class:conflict={highlightErrors && conflicts.has(i)}
      class:boxedge-r={i % 3 === 2}
      class:boxedge-b={Math.floor(i / 9) % 3 === 2}
      onclick={() => onselect(i)}
    >
      {#if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(9, 1fr); aspect-ratio: 1; width: min(92vw, 480px); border: 2px solid var(--ink, #222); gap: 1px; background: var(--ink, #222); }
  .cell { background: #fff; border: none; font-size: clamp(16px, 5vw, 26px); display: flex; align-items: center; justify-content: center; cursor: pointer; aspect-ratio: 1; }
  .cell.given { font-weight: 700; color: #1b3a8f; }
  .cell.selected { background: #cfe3ff; }
  .cell.conflict { background: #ffd5d5; }
  .cell.boxedge-r { border-right: 2px solid var(--ink, #222); margin-right: -1px; }
  .cell.boxedge-b { border-bottom: 2px solid var(--ink, #222); margin-bottom: -1px; }
  .notes { font-size: 10px; color: #888; letter-spacing: 1px; }
</style>
