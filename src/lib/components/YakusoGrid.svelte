<script lang="ts">
  import { MARKED_ZERO, AUTO_ZERO, type YakusoGame } from '../play/yakuso-game';
  import { t } from '$lib/i18n';
  import { gridKeyboard } from '../play/grid-nav';

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
  const isZero = (v: number) => v === MARKED_ZERO || v === AUTO_ZERO;
  const valueOf = (v: number) => (isZero(v) ? '0' : v !== 0 ? String(v) : t('aria.empty'));
  const label = (i: number, v: number) =>
    t('aria.cellAt', { row: Math.floor(i / cols) + 1, col: (i % cols) + 1, value: valueOf(v) });
  // Auto-filled zeros are read-only (locked), so they neither take input nor join keyboard nav.
  const isInput = (i: number) =>
    i < cellView.length && !game.isGiven(i) && cellView[i] !== AUTO_ZERO;
  const firstInput = $derived(cellView.findIndex((v, i) => !game.isGiven(i) && v !== AUTO_ZERO));
  const tabStop = $derived(selected ?? firstInput);
  // One total per column; `null` is hidden — the player must deduce that column's sum.
  const totalCells = $derived(
    game.instance.totals.map((total) => ({
      text: total === null ? '' : String(total),
      hidden: total === null,
      aria: total === null ? t('aria.hiddenTotal') : t('aria.total', { total })
    }))
  );
</script>

<div
  class="grid"
  role="grid"
  aria-label={t('aria.grid', { label: t('puzzle.yakuso') })}
  style="grid-template-columns: repeat({cols}, minmax(0, 1fr)); width: min(92vw, {cols * 56}px);"
  use:gridKeyboard={{ cols, total: cellView.length, focusable: isInput, selected, onselect }}
>
  {#each cellView as v, i (i)}
    {#if game.isGiven(i)}
      <div class="cell given" role="gridcell">{v}</div>
    {:else if v === AUTO_ZERO}
      <div class="cell input auto-zero" role="gridcell" aria-label={label(i, v)}>
        <span class="zero">0</span>
      </div>
    {:else}
      <button
        class="cell input"
        class:selected={selected === i}
        class:conflict={highlightErrors && conflicts.has(i)}
        aria-current={selected === i ? 'true' : undefined}
        aria-label={label(i, v)}
        data-cell={i}
        tabindex={i === tabStop ? 0 : -1}
        onclick={() => onselect(i)}
      >
        {#if v === MARKED_ZERO}<span class="zero">0</span>{:else if v !== 0}{v}{:else if game.notes[i].size}<span class="notes">{[...game.notes[i]].sort().join('')}</span>{/if}
      </button>
    {/if}
  {/each}
  {#each totalCells as cell, c (c)}
    <div
      class="cell total"
      role="gridcell"
      aria-label={cell.aria}
      class:hidden-total={cell.hidden}
      class:firsttotal={c === 0}
    >{cell.text}</div>
  {/each}
</div>

<p class="legend">{t('yakuso.legend', { rows })}</p>

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
  .cell.input.auto-zero { cursor: default; }
  .cell.total {
    background: var(--cell-block);
    color: var(--cell-block-text);
    font-weight: 700;
    margin-top: 4px;
  }
  /* A hidden total: the player must deduce this column's sum. */
  .cell.total.hidden-total { background: var(--surface-3); color: var(--text-muted); }
  .cell.total.hidden-total::before { content: '?'; opacity: 0.5; }
  .notes { font-size: 10px; color: var(--text-muted); letter-spacing: 1px; }
  .legend { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; }
</style>
