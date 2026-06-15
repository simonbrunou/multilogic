<script lang="ts">
  import type { PlayableGame } from '../play/playable';
  import { t } from '$lib/i18n';
  let { game, selected, tick = 0, conflicts = new Set<number>(), highlightErrors = true, onselect }:
    { game: PlayableGame; selected: number | null; tick?: number; conflicts?: Set<number>; highlightErrors?: boolean; onselect: (i: number) => void } = $props();

  const cellView = $derived.by(() => { void tick; return [...game.cells]; });
  const label = (i: number, v: number) =>
    t('aria.cellAt', { row: Math.floor(i / 9) + 1, col: (i % 9) + 1, value: v !== 0 ? String(v) : t('aria.empty') });
</script>

<div class="grid" role="grid">
  {#each cellView as v, i (i)}
    <button
      class="cell"
      class:given={game.isGiven(i)}
      class:selected={selected === i}
      class:conflict={highlightErrors && conflicts.has(i)}
      class:boxedge-r={i % 3 === 2}
      class:boxedge-b={Math.floor(i / 9) % 3 === 2}
      aria-pressed={selected === i}
      aria-label={label(i, v)}
      onclick={() => onselect(i)}
    >
      {#if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(9, 1fr); aspect-ratio: 1; width: min(92vw, 480px); border: 2px solid var(--grid-line); gap: 1px; background: var(--grid-line); }
  .cell { background: var(--surface); color: var(--text); border: none; font-size: clamp(16px, 5vw, 26px); display: flex; align-items: center; justify-content: center; cursor: pointer; aspect-ratio: 1; }
  .cell.given { font-weight: 700; color: var(--accent); }
  .cell.selected { background: var(--selected-bg); }
  .cell.conflict { background: var(--danger-bg); color: var(--danger); box-shadow: inset 0 0 0 2px var(--danger); text-decoration: underline wavy var(--danger); text-underline-offset: 2px; }
  .cell.boxedge-r { border-right: 2px solid var(--grid-line); margin-right: -1px; }
  .cell.boxedge-b { border-bottom: 2px solid var(--grid-line); margin-bottom: -1px; }
  .notes { font-size: 10px; color: var(--text-muted); letter-spacing: 1px; }
</style>
