<script lang="ts">
  import { MARKED_ZERO, type YakusoGame } from '../play/yakuso-game';
  import { t } from '$lib/i18n';

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
  const valueOf = (v: number) => (v === MARKED_ZERO ? '0' : v !== 0 ? String(v) : t('aria.empty'));
  const label = (i: number, v: number) =>
    t('aria.cellAt', { row: Math.floor(i / cols) + 1, col: (i % cols) + 1, value: valueOf(v) });
</script>

<div class="grid" role="grid" style="grid-template-columns: repeat({cols}, minmax(0, 1fr)); width: min(92vw, {cols * 56}px);">
  {#each cellView as v, i (i)}
    {#if game.isGiven(i)}
      <div class="cell given" role="gridcell">{v}</div>
    {:else}
      <button
        class="cell input"
        class:selected={selected === i}
        class:conflict={highlightErrors && conflicts.has(i)}
        role="gridcell"
        aria-selected={selected === i}
        aria-label={label(i, v)}
        onclick={() => onselect(i)}
      >
        {#if v === MARKED_ZERO}<span class="zero">0</span>{:else if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
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
    gap: 2px;
    background: var(--surface-3);
    padding: 2px;
    border-radius: 6px;
  }
  .cell {
    font-size: clamp(16px, 5vw, 26px);
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    min-width: 0;
    padding: 0;
    box-sizing: border-box;
    border: none;
    border-radius: 3px;
  }
  .cell.given { background: var(--given-bg); color: var(--text); font-weight: 700; }
  .cell.input { background: var(--surface); color: var(--accent); cursor: pointer; }
  .cell.input.selected { background: var(--selected-bg); }
  .cell.input.conflict { background: var(--danger-bg); color: var(--danger); box-shadow: inset 0 0 0 2px var(--danger); }
  .cell.input .zero { color: var(--text-muted); font-weight: 700; }
  .cell.total {
    background: var(--cell-block);
    color: var(--cell-block-text);
    font-weight: 700;
    margin-top: 4px;
  }
  .notes { font-size: 10px; color: var(--text-muted); letter-spacing: 1px; }
  .legend { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; }
</style>
