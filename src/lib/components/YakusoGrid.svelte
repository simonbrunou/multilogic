<script lang="ts">
  import type { YakusoGame } from '../play/yakuso-game';

  let {
    game,
    selected = null,
    tick = 0,
    conflicts = new Set<number>(),
    highlightErrors = true,
    onselect
  }: {
    game: YakusoGame;
    selected: number | null;
    tick?: number;
    conflicts?: Set<number>;
    highlightErrors?: boolean;
    onselect: (i: number) => void;
  } = $props();

  const cellView = $derived.by(() => { void tick; return [...game.cells]; });
  const cols = $derived(game.instance.cols);
  const rows = $derived(game.instance.rows);
</script>

<div class="grid" role="grid" style="grid-template-columns: repeat({cols}, 1fr);">
  {#each cellView as v, i (i)}
    {#if game.isGiven(i)}
      <div class="cell given" role="gridcell">{v !== 0 ? v : ''}</div>
    {:else}
      <button
        class="cell input"
        class:selected={selected === i}
        class:conflict={highlightErrors && conflicts.has(i)}
        onclick={() => onselect(i)}
      >
        {#if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
      </button>
    {/if}
  {/each}
  {#each game.instance.totals as total, c (c)}
    <div class="cell total" role="gridcell" class:firsttotal={c === 0}>{total}</div>
  {/each}
</div>

<p class="legend">Totals · {rows} digits</p>

<style>
  .grid {
    display: grid;
    width: min(92vw, 480px);
    gap: 2px;
    background: #d8dbe2;
    padding: 2px;
    border-radius: 6px;
  }
  .cell {
    font-size: clamp(16px, 5vw, 26px);
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    box-sizing: border-box;
    border: none;
    border-radius: 3px;
  }
  .cell.given { background: #e7eaf1; color: #2a2a2a; font-weight: 700; }
  .cell.input { background: #fff; color: #1b3a8f; cursor: pointer; }
  .cell.input.selected { background: #cfe3ff; }
  .cell.input.conflict { background: #ffd5d5; }
  .cell.total {
    background: #2a2a2a;
    color: #fff;
    font-weight: 700;
    margin-top: 4px;
  }
  .notes { font-size: 10px; color: #888; letter-spacing: 1px; }
  .legend { font-size: 12px; color: #666; margin: 4px 0 0; }
</style>
