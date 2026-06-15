<script lang="ts">
  import type { KakuroGame } from '../play/kakuro-game';
  import type { KakuroClue } from '../../engine/puzzles/kakuro/types';
  import { t } from '$lib/i18n';

  let {
    game,
    selected = null,
    tick = 0,
    conflicts = new Set<number>(),
    highlightErrors = true,
    onselect
  }: {
    game: KakuroGame;
    selected: number | null;
    tick?: number;
    conflicts?: Set<number>;
    highlightErrors?: boolean;
    onselect: (i: number) => void;
  } = $props();

  const cellView = $derived.by(() => { void tick; return [...game.cells]; });

  function getClue(i: number): KakuroClue | null {
    return game.instance.clues[i] as KakuroClue | null;
  }
  const label = (i: number, v: number) =>
    t('aria.cellAt', {
      row: Math.floor(i / game.instance.width) + 1,
      col: (i % game.instance.width) + 1,
      value: v !== 0 ? String(v) : t('aria.empty')
    });
</script>

<div class="grid" role="grid" style="grid-template-columns: repeat({game.instance.width}, 1fr);">
  {#each cellView as _v, i (i)}
    {#if game.instance.black[i]}
      {@const clue = getClue(i)}
      <div class="cell black" role="gridcell">
        {#if clue && (clue.down !== undefined || clue.right !== undefined)}
          <svg class="clue-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="100" class="clue-line" stroke-width="2" />
            {#if clue.right !== undefined}
              <text x="72" y="38" text-anchor="middle" class="clue-text">{clue.right}</text>
            {/if}
            {#if clue.down !== undefined}
              <text x="28" y="82" text-anchor="middle" class="clue-text">{clue.down}</text>
            {/if}
          </svg>
        {/if}
      </div>
    {:else}
      {@const v = cellView[i]}
      <button
        class="cell white"
        class:selected={selected === i}
        class:conflict={highlightErrors && conflicts.has(i)}
        aria-pressed={selected === i}
        aria-label={label(i, v)}
        onclick={() => onselect(i)}
      >
        {#if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .grid {
    display: grid;
    aspect-ratio: 1;
    width: min(92vw, 480px);
    gap: 0;
  }
  .cell {
    border: 1px solid var(--border);
    color: var(--text);
    font-size: clamp(14px, 4vw, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }
  .cell.black {
    background: var(--cell-block);
    cursor: default;
    padding: 0;
  }
  .cell.white {
    background: var(--surface);
    cursor: pointer;
  }
  .cell.white.selected { background: var(--selected-bg); }
  .cell.white.conflict { background: var(--danger-bg); color: var(--danger); box-shadow: inset 0 0 0 2px var(--danger); text-decoration: underline wavy var(--danger); text-underline-offset: 2px; }
  .clue-svg {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  .clue-line {
    stroke: color-mix(in oklch, var(--cell-block-text) 55%, transparent);
  }
  .clue-text {
    fill: var(--cell-block-text);
    font-size: 28px;
    font-family: system-ui, sans-serif;
    font-weight: 600;
  }
  .notes { font-size: 10px; color: var(--text-muted); letter-spacing: 1px; }
</style>
